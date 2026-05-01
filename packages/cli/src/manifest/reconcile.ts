import type { Manifest, ManifestResource } from "@envmanifest/schema";
import type { ConfigReference } from "../scanner/types.js";
import type { DotenvFile } from "../dotenv/parse.js";
import type { WranglerBinding } from "../wrangler/parse.js";

export type FindingSeverity = "error" | "warning" | "info";

export interface Finding {
  severity: FindingSeverity;
  code: string;
  name?: string;
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

export function reconcile(input: ReconcileInput): Finding[] {
  const { env, manifest, refs, dotenvFiles } = input;
  const wranglerBindings = input.wranglerBindings ?? [];
  const findings: Finding[] = [];

  const wranglerBindingNames = new Set(wranglerBindings.map((b) => b.name));

  const declared = new Map<string, ManifestResource>();
  const aliases = new Map<string, string>();
  for (const r of manifest.resources ?? []) {
    declared.set(r.name, r);
    for (const a of r.alias ?? []) aliases.set(a, r.name);
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

  for (const [name, resource] of declared) {
    if (!resource.environments?.includes(env)) continue;
    if (resource.platform_generated) continue;
    if (resource.required === false) continue;

    if (resource.kind === "binding") {
      if (!wranglerBindingNames.has(name)) {
        findings.push({
          severity: "warning",
          code: "binding.missing",
          name,
          message: `${name} declared as binding but missing from wrangler config`,
          hint: `add it to wrangler.toml/wrangler.jsonc, or change kind`,
        });
      }
      continue;
    }

    const usedInCode = codeRefNames.has(name) || resource.alias?.some((a) => codeRefNames.has(a));
    const presentInDotenv = dotenvNames.has(name) || resource.alias?.some((a) => dotenvNames.has(a));

    if (!usedInCode) {
      findings.push({
        severity: "info",
        code: "manifest.unused",
        name,
        message: `${name} declared but not referenced in code`,
      });
    }

    if (env === "local" || env === "dev" || env === "development") {
      if (!presentInDotenv) {
        findings.push({
          severity: "error",
          code: "dotenv.missing",
          name,
          message: `${name} required for env=${env} but missing from .env*`,
          hint: `add ${name}= to your .env file`,
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

  for (const [name, resource] of declared) {
    if (resource.never_in?.includes(env) && dotenvNames.has(name)) {
      findings.push({
        severity: "error",
        code: "policy.forbidden",
        name,
        message: `${name} must NOT be set in env=${env}`,
        hint: resource.description,
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
