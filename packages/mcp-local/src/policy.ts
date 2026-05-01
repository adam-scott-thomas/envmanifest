import type { Manifest } from "@envmanifest/schema";
import type { RedactionLevel } from "./redact.js";

export interface ResolvedPolicy {
  redaction: RedactionLevel;
  exposeNames: boolean;
  exposeProviderMetadata: boolean;
  exposeValues: boolean;
  allowedTools: Set<string>;
  deniedTools: Set<string>;
}

const DEFAULT_ALLOWED = new Set([
  "list_required",
  "validate",
  "explain_requirement",
  "resolve_source",
  "list_missing",
]);

const DEFAULT_DENIED = new Set(["read_values", "mutate_provider"]);

export function resolvePolicy(manifest: Manifest | null): ResolvedPolicy {
  const mcp = manifest?.policies?.mcp;
  return {
    redaction: (mcp?.redaction as RedactionLevel) ?? "partial",
    exposeNames: mcp?.expose?.names ?? true,
    exposeProviderMetadata: mcp?.expose?.provider_metadata ?? true,
    exposeValues: mcp?.expose?.values ?? false,
    allowedTools: new Set(mcp?.allowed_tools ?? Array.from(DEFAULT_ALLOWED)),
    deniedTools: new Set(mcp?.denied_tools ?? Array.from(DEFAULT_DENIED)),
  };
}

export function isToolAllowed(policy: ResolvedPolicy, tool: string): boolean {
  if (policy.deniedTools.has(tool)) return false;
  return policy.allowedTools.has(tool);
}
