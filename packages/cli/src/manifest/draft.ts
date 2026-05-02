import type { ConfigReference } from "../scanner/types.js";
import type { WranglerBinding } from "../wrangler/parse.js";
import { inferResource } from "./heuristics.js";

export interface DraftOptions {
  project: string;
  environments?: string[];
  bindings?: WranglerBinding[];
}

/**
 * Well-known prefixes that always trigger the env_prefix heuristic regardless
 * of cluster size. These are universal JS-ecosystem conventions where the
 * prefix carries semantic meaning (publicly bundled), so even a single
 * NEXT_PUBLIC_FOO is more useful as a service-prefix declaration than a
 * raw resource.
 */
const KNOWN_PUBLIC_PREFIXES = [
  "NEXT_PUBLIC_",
  "VITE_",
  "EXPO_PUBLIC_",
  "REACT_APP_",
  "GATSBY_",
  "STORYBOOK_",
  "PUBLIC_",
];

/** Auto-detect threshold: any prefix shared by 3+ names triggers grouping. */
const AUTO_DETECT_THRESHOLD = 3;

interface PrefixGroup {
  prefix: string;
  serviceName: string;
  unprefixedNames: string[];
}

/**
 * Detects shared prefixes across the name set. Returns a list of groups plus
 * the residual ungrouped names. A name belongs to at most one group (the
 * longest matching prefix wins).
 */
export function detectPrefixGroups(names: string[]): {
  groups: PrefixGroup[];
  ungrouped: string[];
} {
  const groups: PrefixGroup[] = [];
  const claimed = new Set<string>();

  // Pass 1: known public prefixes (always claim, even at count=1).
  for (const prefix of KNOWN_PUBLIC_PREFIXES) {
    const matched = names.filter((n) => n.startsWith(prefix) && !claimed.has(n));
    if (matched.length === 0) continue;
    for (const m of matched) claimed.add(m);
    groups.push({
      prefix,
      serviceName: prefixToServiceName(prefix),
      unprefixedNames: matched.map((n) => n.slice(prefix.length)).sort(),
    });
  }

  // Pass 2: auto-detect any custom prefix shared by 3+ unclaimed names.
  // Build prefix counts: for each unclaimed name, every PREFIX_ candidate
  // up to the last underscore is a possible group key.
  const prefixCounts = new Map<string, string[]>();
  for (const name of names) {
    if (claimed.has(name)) continue;
    // Walk underscore positions left to right; any prefix ending in _ is a candidate.
    for (let i = 0; i < name.length; i++) {
      if (name[i] === "_") {
        const candidate = name.slice(0, i + 1);
        // Skip too-short prefixes (single letter + _) — too generic.
        if (candidate.length < 3) continue;
        const list = prefixCounts.get(candidate) ?? [];
        list.push(name);
        prefixCounts.set(candidate, list);
      }
    }
  }

  // Pick the longest qualifying prefix that still has ≥3 members.
  // Sort candidates by (length desc, count desc) to prefer specificity.
  const candidates = Array.from(prefixCounts.entries())
    .filter(([, members]) => members.length >= AUTO_DETECT_THRESHOLD)
    .sort((a, b) => {
      if (b[0].length !== a[0].length) return b[0].length - a[0].length;
      return b[1].length - a[1].length;
    });

  for (const [prefix, members] of candidates) {
    // Re-check: any member already claimed by a longer prefix?
    const fresh = members.filter((m) => !claimed.has(m));
    if (fresh.length < AUTO_DETECT_THRESHOLD) continue;
    for (const m of fresh) claimed.add(m);
    groups.push({
      prefix,
      serviceName: prefixToServiceName(prefix),
      unprefixedNames: fresh.map((n) => n.slice(prefix.length)).sort(),
    });
  }

  const ungrouped = names.filter((n) => !claimed.has(n)).sort();
  return { groups, ungrouped };
}

function prefixToServiceName(prefix: string): string {
  // Strip trailing _, lowercase, replace internal _ with -.
  const base = prefix.replace(/_$/, "").toLowerCase().replace(/_/g, "-");
  // Special-case the public web prefixes → "web".
  if (
    [
      "next-public",
      "vite",
      "expo-public",
      "react-app",
      "gatsby",
      "storybook",
      "public",
    ].includes(base)
  ) {
    return "web";
  }
  return base || "default";
}

export function draftManifestYaml(
  refs: ConfigReference[],
  opts: DraftOptions,
): string {
  const distinctNames = new Set<string>();
  for (const ref of refs) {
    if (ref.name) distinctNames.add(ref.name);
  }
  const names = Array.from(distinctNames).sort();
  const environments = opts.environments ?? [
    "local",
    "dev",
    "staging",
    "production",
  ];

  const { groups, ungrouped } = detectPrefixGroups(names);

  const lines: string[] = [];
  lines.push(`# Drafted by 'envmanifest init'. Review and edit before committing.`);
  lines.push(`# yaml-language-server: $schema=https://env.ghostlogic.tech/schemas/v0/manifest.schema.json`);
  lines.push("");
  lines.push(`version: 0`);
  lines.push(`compatibility: experimental`);
  lines.push(`project: ${quote(opts.project)}`);
  lines.push("");
  lines.push(`environments: [${environments.map(quote).join(", ")}]`);

  // Emit services block when we have any prefix groups.
  if (groups.length > 0) {
    lines.push("");
    lines.push(`services:`);
    for (const g of groups) {
      lines.push(`  - name: ${g.serviceName}`);
      lines.push(`    env_prefix: ${g.prefix}`);
      lines.push(
        `    # ${g.unprefixedNames.length} resource${g.unprefixedNames.length === 1 ? "" : "s"} share this prefix; envmanifest groups them under one service.`,
      );
    }
  }

  lines.push("");
  lines.push(`resources:`);

  const bindings = opts.bindings ?? [];

  if (names.length === 0 && bindings.length === 0) {
    lines.push(`  []  # no config references detected — add manually as needed`);
    return lines.join("\n") + "\n";
  }

  for (const binding of bindings) {
    lines.push(`  - name: ${binding.name}`);
    lines.push(`    kind: binding`);
    lines.push(`    exposure: server`);
    lines.push(`    phase: [runtime]`);
    lines.push(`    environments: [${environments.map(quote).join(", ")}]`);
    lines.push(`    binding:`);
    lines.push(`      provider: ${binding.provider}`);
    lines.push(`      resource_type: ${binding.resource_type}`);
    if (binding.resource_id) {
      lines.push(`      resource_id: ${quote(binding.resource_id)}`);
    }
    lines.push(`    # detected in wrangler config`);
    lines.push("");
  }

  // Emit grouped resources first (one block per prefix group), then ungrouped.
  for (const g of groups) {
    for (const unprefixed of g.unprefixedNames) {
      const fullName = g.prefix + unprefixed;
      const inferred = inferResource(fullName);
      const refsForName = refs.filter((r) => r.name === fullName);
      const sample = refsForName[0];
      lines.push(`  - name: ${unprefixed}`);
      lines.push(`    service: ${g.serviceName}`);
      lines.push(`    kind: ${inferred.kind}`);
      if (inferred.type) lines.push(`    type: ${inferred.type}`);
      lines.push(`    exposure: ${inferred.exposure}`);
      lines.push(`    phase: [runtime]`);
      lines.push(`    environments: [${environments.map(quote).join(", ")}]`);
      if (inferred.platform_generated) {
        lines.push(`    platform_generated: true`);
        lines.push(`    required: false`);
      }
      if (sample) {
        lines.push(
          `    # effective: ${fullName} (detected at ${sample.file}:${sample.line}, ${refsForName.length} reference${refsForName.length === 1 ? "" : "s"})`,
        );
      }
      lines.push("");
    }
  }

  for (const name of ungrouped) {
    const inferred = inferResource(name);
    const refsForName = refs.filter((r) => r.name === name);
    const sample = refsForName[0];
    lines.push(`  - name: ${name}`);
    lines.push(`    kind: ${inferred.kind}`);
    if (inferred.type) lines.push(`    type: ${inferred.type}`);
    lines.push(`    exposure: ${inferred.exposure}`);
    lines.push(`    phase: [runtime]`);
    lines.push(`    environments: [${environments.map(quote).join(", ")}]`);
    if (inferred.platform_generated) {
      lines.push(`    platform_generated: true`);
      lines.push(`    required: false`);
    }
    if (sample) {
      lines.push(
        `    # detected at ${sample.file}:${sample.line} (${refsForName.length} reference${refsForName.length === 1 ? "" : "s"})`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function quote(s: string): string {
  if (/^[a-zA-Z0-9_-]+$/.test(s)) return s;
  return JSON.stringify(s);
}
