import schemaJson from "../manifest.schema.v0.json" with { type: "json" };

export const manifestSchemaV0 = schemaJson;
export const SCHEMA_VERSION = 0 as const;
export const SCHEMA_URL =
  "https://env.ghostlogic.tech/schemas/v0/manifest.schema.json" as const;

export type Environment = string;

export type ResourceKind = "env" | "secret" | "binding";
export type Exposure = "server" | "public" | "ci" | "client";
export type Phase = "build" | "runtime";
export type ValidationMode = "presence" | "metadata" | "value_local" | "probe";

export interface ManifestSource {
  provider: string;
  ref?: string;
  environments?: Environment[];
}

export interface ManifestProbe {
  name: string;
  command: string;
  timeout?: string;
  environments?: Environment[];
}

export interface ManifestValidation {
  mode: ValidationMode;
  must_match?: string;
  max_age?: string;
}

export interface ManifestBinding {
  provider: string;
  resource_type: string;
  resource_id: string;
  permissions?: string[];
}

export interface ManifestRule {
  if: Record<string, unknown>;
  require_pattern?: string;
  require_env?: Environment[];
  message?: string;
}

export interface ManifestResource {
  name: string;
  kind: ResourceKind;
  type?: string;
  exposure: Exposure;
  phase: Phase[];
  service?: string;
  environments: Environment[];
  description?: string;
  owner?: string;
  required?: boolean;
  default?: unknown;
  values?: unknown[];
  pattern?: string;
  alias?: string[];
  conflicts_with?: string[];
  never_in?: Environment[];
  platform_generated?: boolean;
  deprecated?: boolean | string;
  deprecated_after?: string;
  rotate_every?: string;
  tags?: string[];
  sources?: ManifestSource[];
  probes?: ManifestProbe[];
  validation?: ManifestValidation;
  binding?: ManifestBinding;
  rules?: ManifestRule[];
}

export interface ManifestService {
  name: string;
  root?: string;
  runtime?: string;
  deploy?: {
    provider: string;
    project?: string;
  };
}

export interface ManifestPolicies {
  mcp?: {
    expose?: { names?: boolean; provider_metadata?: boolean; values?: boolean };
    redaction?: "off" | "partial" | "full";
    allowed_tools?: string[];
    denied_tools?: string[];
  };
  scanner?: {
    fail_on_dynamic?: boolean;
    languages?: string[];
  };
  seal?: {
    min_level?: "L0" | "L1" | "L2" | "L3" | "L4";
    format?: string[];
  };
}

export interface Manifest {
  version: 0;
  compatibility?: "experimental" | "stable";
  project: string;
  environments: Environment[];
  services?: ManifestService[];
  ignore?: string[];
  policies?: ManifestPolicies;
  resources: ManifestResource[];
}
