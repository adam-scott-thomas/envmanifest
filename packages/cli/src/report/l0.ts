import type { Manifest } from "@envmanifest/schema";
import type { Finding } from "../manifest/reconcile.js";
import { keySetHash, manifestHash } from "./hash.js";

export interface L0Report {
  schema: "envmanifest.l0";
  schema_version: 1;
  level: "L0";
  signed: false;
  project: string;
  environment: string;
  manifest_hash: string;
  key_set_hash: string;
  required_present: boolean;
  drift: Array<{
    code: string;
    severity: Finding["severity"];
    name?: string;
    message: string;
  }>;
  observed_at: string;
  cli_version: string;
  schema_url: string;
}

export interface BuildL0Input {
  manifest: Manifest;
  manifestSource: string;
  env: string;
  findings: Finding[];
  presentNames: string[];
  cliVersion: string;
  observedAt?: Date;
}

export function buildL0Report(input: BuildL0Input): L0Report {
  const observedAt = (input.observedAt ?? new Date()).toISOString();
  const drift = input.findings.map((f) => {
    const out: L0Report["drift"][number] = {
      code: f.code,
      severity: f.severity,
      message: f.message,
    };
    if (f.name !== undefined) out.name = f.name;
    return out;
  });
  const requiredPresent = !input.findings.some(
    (f) => f.severity === "error" && f.code === "dotenv.missing",
  );

  return {
    schema: "envmanifest.l0",
    schema_version: 1,
    level: "L0",
    signed: false,
    project: input.manifest.project,
    environment: input.env,
    manifest_hash: manifestHash(input.manifestSource),
    key_set_hash: keySetHash(input.presentNames),
    required_present: requiredPresent,
    drift,
    observed_at: observedAt,
    cli_version: input.cliVersion,
    schema_url: "https://env.ghostlogic.tech/schemas/v1/seal-l0.schema.json",
  };
}
