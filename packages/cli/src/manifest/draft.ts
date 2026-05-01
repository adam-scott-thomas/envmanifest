import type { ConfigReference } from "../scanner/types.js";
import type { WranglerBinding } from "../wrangler/parse.js";
import { inferResource } from "./heuristics.js";

export interface DraftOptions {
  project: string;
  environments?: string[];
  bindings?: WranglerBinding[];
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
  const environments = opts.environments ?? ["local", "dev", "staging", "production"];

  const lines: string[] = [];
  lines.push(`# Drafted by 'envmanifest init'. Review and edit before committing.`);
  lines.push(`# yaml-language-server: $schema=https://env.ghostlogic.tech/schemas/v0/manifest.schema.json`);
  lines.push("");
  lines.push(`version: 0`);
  lines.push(`compatibility: experimental`);
  lines.push(`project: ${quote(opts.project)}`);
  lines.push("");
  lines.push(`environments: [${environments.map(quote).join(", ")}]`);
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

  for (const name of names) {
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
      lines.push(`    # detected at ${sample.file}:${sample.line} (${refsForName.length} reference${refsForName.length === 1 ? "" : "s"})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function quote(s: string): string {
  if (/^[a-zA-Z0-9_-]+$/.test(s)) return s;
  return JSON.stringify(s);
}
