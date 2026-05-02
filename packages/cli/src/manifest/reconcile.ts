import type { Manifest, ManifestResource } from "@envmanifest/schema";
import type { ConfigReference } from "../scanner/types.js";
import type { DotenvFile } from "../dotenv/parse.js";
import type { WranglerBinding } from "../wrangler/parse.js";

export type FindingSeverity = "error" | "warning" | "info";

export interface Finding {
  severity: FindingSeverity;
  code: string;
  /** Effective name (with service env_prefix applied) — what humans and runtimes see. */
  name?: string;
  /** Raw resource name as written in manifest.yml. Set only when distinct from `name` (i.e. a service env_prefix was applied). Lets consumers render "RAW → EFFECTIVE (prefix: X)" without re-walking the manifest. */
  rawName?: string;
  message: string;
  hint?: string;
}

export interface ReconcileInput {
  env: string;
  manifest: Manifest;
  refs: ConfigReference[];
  dotenvFiles: DotenvFile[];
  wranglerBindings?: WranglerBinding[];
}

/**
 * Returns the effective resource name as seen by code / .env files / runtime.
 * This is service.env_prefix + resource.name when both are set, otherwise
 * just resource.name. Aliases are NOT prefixed — they're plain alternates.
 */
export function effectiveName(
  resource: ManifestResource,
  manifest: Manifest,
): string {
  if (!resource.service) return resource.name;
  const svc = manifest.services?.find((s) => s.name === resource.service);
  if (!svc?.env_prefix) return resource.name;
  return svc.env_prefix + resource.name;
}

export function reconcile(input: ReconcileInput): Finding[] {
  const { env, manifest, refs, dotenvFiles } = input;
  const wranglerBindings = input.wranglerBindings ?? [];
  const findings: Finding[] = [];

  const wranglerBindingNames = new Set(wranglerBindings.map((b) => b.name));

  // Build forward + reverse lookups keyed by EFFECTIVE name (prefix-applied).
  // declared: effective name → resource (the canonical one)
  // aliases: alias → effective name of canonical resource (aliases NOT prefixed)
  const declared = new Map<string, ManifestResource>();
  const aliases = new Map<string, string>();
  for (const r of manifest.resources ?? []) {
    const eff = effectiveName(r, manifest);
    declared.set(eff, r);
    for (const a of r.alias ?? []) aliases.set(a, eff);
  }

  const codeRefNames = new Set(
    refs.map((r) => r.name).filter((n): n is string => Boolean(n)),
  );

  const dotenvNames = new Set<string>();
  for (const f of dotenvFiles) for (const n of f.names) dotenvNames.add(n);

  for (const name of codeRefNames) {
    if (!declared.has(name) && !aliases.has(name)) {
      findings.push({
        severity: "error",
        code: "code.undeclared",
        name,
        message: `${name} referenced in code but not declared in manifest`,
        hint: `add a 'resources:' entry, or rename to an existing alias`,
      });
    }
  }

  for (const name of dotenvNames) {
    if (!declared.has(name) && !aliases.has(name)) {
      findings.push({
        severity: "warning",
        code: "dotenv.undeclared",
        name,
        message: `${name} present in .env* but not declared in manifest`,
      });
    }
  }

  for (const [eff, resource] of declared) {
    if (!resource.environments?.includes(env)) continue;
    if (resource.platform_generated) continue;
    if (resource.required === false) continue;

    const rawName = resource.name;
    const hasPrefix = eff !== rawName;

    if (resource.kind === "binding") {
      if (!wranglerBindingNames.has(eff)) {
        findings.push({
          severity: "warning",
          code: "binding.missing",
          name: eff,
          ...(hasPrefix && { rawName }),
          message: `${eff} declared as binding but missing from wrangler config`,
          hint: `add it to wrangler.toml/wrangler.jsonc, or change kind`,
        });
      }
      continue;
    }

    const usedInCode =
      codeRefNames.has(eff) || resource.alias?.some((a) => codeRefNames.has(a));
    const presentInDotenv =
      dotenvNames.has(eff) || resource.alias?.some((a) => dotenvNames.has(a));

    if (!usedInCode) {
      findings.push({
        severity: "info",
        code: "manifest.unused",
        name: eff,
        ...(hasPrefix && { rawName }),
        message: `${eff} declared but not referenced in code`,
      });
    }

    if (env === "local" || env === "dev" || env === "development") {
      if (!presentInDotenv) {
        findings.push({
          severity: "error",
          code: "dotenv.missing",
          name: eff,
          ...(hasPrefix && { rawName }),
          message: `${eff} required for env=${env} but missing from .env*`,
          hint: `add ${eff}= to your .env file`,
        });
      }
    }
  }

  for (const binding of wranglerBindings) {
    if (!declared.has(binding.name) && !aliases.has(binding.name)) {
      findings.push({
        severity: "warning",
        code: "binding.undeclared",
        name: binding.name,
        message: `${binding.name} bound in wrangler config (${binding.provider}) but not declared in manifest`,
      });
    }
  }

  for (const [eff, resource] of declared) {
    if (resource.never_in?.includes(env) && dotenvNames.has(eff)) {
      const rawName = resource.name;
      const hasPrefix = eff !== rawName;
      findings.push({
        severity: "error",
        code: "policy.forbidden",
        name: eff,
        ...(hasPrefix && { rawName }),
        message: `${eff} must NOT be set in env=${env}`,
        ...(resource.description !== undefined && { hint: resource.description }),
      });
    }
  }

  findings.sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 } as const;
    if (order[a.severity] !== order[b.severity]) {
      return order[a.severity] - order[b.severity];
    }
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  return findings;
}
