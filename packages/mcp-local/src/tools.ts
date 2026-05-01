import type { Manifest, ManifestResource } from "@envmanifest/schema";
import { resourcesFor } from "./manifest.js";
import { redactName, type RedactionLevel } from "./redact.js";
import type { ResolvedPolicy } from "./policy.js";

export interface ToolContext {
  manifest: Manifest;
  policy: ResolvedPolicy;
}

interface ResourceSummary {
  name: string;
  kind: string;
  exposure: string;
  required?: boolean;
  type?: string;
  service?: string;
  description?: string;
}

function summarize(
  r: ManifestResource,
  redaction: RedactionLevel,
): ResourceSummary {
  const out: ResourceSummary = {
    name: redactName(r.name, redaction),
    kind: r.kind,
    exposure: r.exposure,
  };
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
    .map((r) => summarize(r, ctx.policy.redaction));
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
  const declared = new Set<string>();
  const aliasMap = new Map<string, string>();
  for (const r of ctx.manifest.resources ?? []) {
    declared.add(r.name);
    for (const a of r.alias ?? []) aliasMap.set(a, r.name);
  }

  const present = new Set(args.presentNames);
  const missing: string[] = [];
  const forbidden: string[] = [];

  for (const r of required) {
    if (r.required === false || r.platform_generated) continue;
    const has =
      present.has(r.name) || (r.alias?.some((a) => present.has(a)) ?? false);
    if (!has) missing.push(redactName(r.name, ctx.policy.redaction));
    if (r.never_in?.includes(args.env) && has) {
      forbidden.push(redactName(r.name, ctx.policy.redaction));
    }
  }

  const unknown: string[] = [];
  for (const name of args.presentNames) {
    if (!declared.has(name) && !aliasMap.has(name)) {
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
  const resource = (ctx.manifest.resources ?? []).find(
    (r) => r.name === args.name || r.alias?.includes(args.name),
  );
  if (!resource) return { found: false };
  const sum = summarize(resource, ctx.policy.redaction);
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
  const resource = (ctx.manifest.resources ?? []).find(
    (r) => r.name === args.name || r.alias?.includes(args.name),
  );
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
