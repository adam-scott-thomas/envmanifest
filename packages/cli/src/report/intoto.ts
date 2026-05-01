import type { L0Report } from "./l0.js";
import { sha256Hex } from "./hash.js";

export interface InTotoStatement {
  _type: "https://in-toto.io/Statement/v1";
  subject: Array<{ name: string; digest: Record<string, string> }>;
  predicateType: "https://envmanifest.dev/attestation/v1";
  predicate: {
    level: L0Report["level"];
    environment: string;
    manifest_hash: string;
    key_set_hash: string;
    required_present: boolean;
    drift: L0Report["drift"];
    observed_at: string;
    cli_version: string;
  };
}

export interface BuildInTotoInput {
  l0: L0Report;
  subjects?: Array<{ name: string; digest: Record<string, string> }>;
}

export function buildInTotoStatement(input: BuildInTotoInput): InTotoStatement {
  const subjects =
    input.subjects && input.subjects.length > 0
      ? input.subjects
      : [
          {
            name: input.l0.project,
            digest: { sha256: sha256Hex(input.l0.manifest_hash) },
          },
        ];

  return {
    _type: "https://in-toto.io/Statement/v1",
    subject: subjects,
    predicateType: "https://envmanifest.dev/attestation/v1",
    predicate: {
      level: input.l0.level,
      environment: input.l0.environment,
      manifest_hash: input.l0.manifest_hash,
      key_set_hash: input.l0.key_set_hash,
      required_present: input.l0.required_present,
      drift: input.l0.drift,
      observed_at: input.l0.observed_at,
      cli_version: input.l0.cli_version,
    },
  };
}
