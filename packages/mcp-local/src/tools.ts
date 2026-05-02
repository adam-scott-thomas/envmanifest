import type { Manifest, ManifestResource } from "@envmanifest/schema";
import { resourcesFor, effectiveName } from "./manifest.js";
import { redactName, type RedactionLevel } from "./redact.js";
import type { ResolvedPolicy } from "./policy.js";

export interface ToolContext {
  manifest: Manifest;
  policy: ResolvedPolicy;
}

interface ResourceSummary {
  /** Effective name (with service env_prefix applied), redacted per policy. This is what the runtime / .env file actually sees. */
  name: string;
  /** Raw resource name as written in manifest.yml. Set only when distinct from `name`. */
  raw_name?: string;
  /** Service env_prefix in effect, if any. */
  prefix?: string;
  kind: string;
  exposure: string;
  required?: boolean;
  type?: string;
  service?: string;
  description?: string;
}

function summarize(
  r: ManifestResource,
  manifest: Manifest,
  redaction: RedactionLevel,
): ResourceSummary {
  const eff = effectiveName(r, manifest);
  const out: ResourceSummary = {
    name: redactName(eff, redaction),
    kind: r.kind,
    exposure: r.exposure,
  };
  if (eff !== r.name) {
    out.raw_name = redactName(r.name, redaction);
    out.prefix = eff.slice(0, eff.length - r.name.length);
  }
  if (r.required !== undefined) out.required = r.required;
  if (r.type) out.type = r.type;
  if (r.service) out.service = r.service;
  if (r.description) out.description = r.description;
  return out;
}

export interface ListRequiredArgs {
  env: string;
  service?: string;
}

export function listRequired(
  ctx: ToolContext,
  args: ListRequiredArgs,
): { resources: ResourceSummary[] } {
  const resources = resourcesFor(ctx.manifest, args.env, args.service)
    .filter((r) => r.required !== false)
    .map((r) => summarize(r, ctx.manifest, ctx.policy.redaction));
  return { resources };
}

export interface ValidateArgs {
  env: string;
  service?: string;
  presentNames: string[];
}

export interface ValidateResult {
  ok: boolean;
  missing: string[];
  forbidden: string[];
  unknown: string[];
}

export function validate(
  ctx: ToolContext,
  args: ValidateArgs,
): ValidateResult {
  const required = resourcesFor(ctx.manifest, args.env, args.service);

  // Build effective-name lookup so present-set comparisons match what the
  // runtime actually sees. Aliases are not prefixed (plain alternates).
  const declaredEffective = new Set<string>();
  const aliasMap = new Map<string, string>();
  for (const r of ctx.manifest.resources ?? []) {
    declaredEffective.add(effectiveName(r, ctx.manifest));
    for (const a of r.alias ?? []) aliasMap.set(a, r.name);
  }

  const present = new Set(args.presentNames);
  const missing: string[] = [];
  const forbidden: string[] = [];

  for (const r of required) {
    if (r.required === false || r.platform_generated) continue;
    const eff = effectiveName(r, ctx.manifest);
    const has = present.has(eff) || (r.alias?.some((a) => present.has(a)) ?? false);
    if (!has) missing.push(redactName(eff, ctx.policy.redaction));
    if (r.never_in?.includes(args.env) && has) {
      forbidden.push(redactName(eff, ctx.policy.redaction));
    }
  }

  const unknown: string[] = [];
  for (const name of args.presentNames) {
    if (!declaredEffective.has(name) && !aliasMap.has(name)) {
      unknown.push(redactName(name, ctx.policy.redaction));
    }
  }

  return { ok: missing.length === 0 && forbidden.length === 0, missing, forbidden, unknown };
}

export interface ExplainArgs {
  name: string;
}

export interface ExplainResult {
  found: boolean;
  resource?: ResourceSummary & {
    phase: string[];
    environments: string[];
    deprecated?: boolean | string;
    rotate_every?: string;
    tags?: string[];
  };
}

export function explainRequirement(
  ctx: ToolContext,
  args: ExplainArgs,
): ExplainResult {
  // Match against effective name, raw name, or any alias.
  const resource = (ctx.manifest.resources ?? []).find((r) => {
    if (r.name === args.name) return true;
    if (r.alias?.includes(args.name)) return true;
    if (effectiveName(r, ctx.manifest) === args.name) return true;
    return false;
  });
  if (!resource) return { found: false };
  const sum = summarize(resource, ctx.manifest, ctx.policy.redaction);
  return {
    found: true,
    resource: {
      ...sum,
      phase: resource.phase,
      environments: resource.environments,
      ...(resource.deprecated !== undefined && { deprecated: resource.deprecated }),
      ...(resource.rotate_every !== undefined && { rotate_every: resource.rotate_every }),
      ...(resource.tags !== undefined && { tags: resource.tags }),
    },
  };
}

export interface ResolveSourceArgs {
  name: string;
  env: string;
}

export interface ResolveSourceResult {
  found: boolean;
  sources: Array<{ provider: string; ref?: string }>;
}

export function resolveSource(
  ctx: ToolContext,
  args: ResolveSourceArgs,
): ResolveSourceResult {
  const resource = (ctx.manifest.resources ?? []).find((r) => {
    if (r.name === args.name) return true;
    if (r.alias?.includes(args.name)) return true;
    if (effectiveName(r, ctx.manifest) === args.name) return true;
    return false;
  });
  if (!resource) return { found: false, sources: [] };

  const sources = (resource.sources ?? [])
    .filter((s) => !s.environments || s.environments.includes(args.env))
    .map((s) => {
      const out: { provider: string; ref?: string } = { provider: s.provider };
      if (ctx.policy.exposeProviderMetadata && s.ref !== undefined) out.ref = s.ref;
      return out;
    });

  return { found: true, sources };
}

export interface ListMissingArgs {
  env: string;
  service?: string;
  presentNames: string[];
}

export function listMissing(
  ctx: ToolContext,
  args: ListMissingArgs,
): { missing: string[] } {
  const v = validate(ctx, args);
  return { missing: v.missing };
}
