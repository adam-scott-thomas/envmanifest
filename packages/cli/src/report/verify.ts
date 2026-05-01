import { readFile } from "node:fs/promises";
import type { L0Report } from "./l0.js";
import type { InTotoStatement } from "./intoto.js";

export type VerifyResult =
  | { ok: true; level: string; signed: boolean; format: "l0" | "intoto"; project: string; environment: string }
  | { ok: false; reason: string };

interface InTotoEnvelope {
  _type: string;
  predicateType: string;
  predicate: { level?: string; environment?: string };
  subject: Array<{ name: string }>;
}

export async function verifyFile(absPath: string): Promise<VerifyResult> {
  let raw: string;
  try {
    raw = await readFile(absPath, "utf8");
  } catch (err) {
    return {
      ok: false,
      reason: `cannot read ${absPath}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      reason: `not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (looksLikeInToto(parsed)) {
    return verifyInToto(parsed as InTotoEnvelope);
  }
  if (looksLikeL0(parsed)) {
    return verifyL0(parsed as L0Report);
  }
  return { ok: false, reason: "unrecognized report format (expected envmanifest L0 or in-toto v1)" };
}

function looksLikeInToto(x: unknown): boolean {
  return (
    typeof x === "object" &&
    x !== null &&
    "_type" in x &&
    typeof (x as { _type: unknown })._type === "string" &&
    (x as { _type: string })._type.startsWith("https://in-toto.io/Statement/")
  );
}

function looksLikeL0(x: unknown): boolean {
  return (
    typeof x === "object" &&
    x !== null &&
    "schema" in x &&
    (x as { schema: unknown }).schema === "envmanifest.l0"
  );
}

function verifyL0(report: L0Report): VerifyResult {
  if (report.signed) {
    return { ok: false, reason: "report claims signed=true but no signature verifier present (this CLI verifies L0 unsigned only)" };
  }
  const requiredFields = ["project", "environment", "manifest_hash", "key_set_hash", "observed_at"] as const;
  for (const f of requiredFields) {
    if (!report[f]) return { ok: false, reason: `missing required field: ${f}` };
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(report.manifest_hash)) {
    return { ok: false, reason: "manifest_hash is not sha256:<64-hex>" };
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(report.key_set_hash)) {
    return { ok: false, reason: "key_set_hash is not sha256:<64-hex>" };
  }
  return {
    ok: true,
    level: report.level,
    signed: report.signed,
    format: "l0",
    project: report.project,
    environment: report.environment,
  };
}

function verifyInToto(env: InTotoEnvelope): VerifyResult {
  if (env.predicateType !== "https://envmanifest.dev/attestation/v1") {
    return {
      ok: false,
      reason: `unexpected predicateType '${env.predicateType}'`,
    };
  }
  if (!env.predicate?.level || !env.predicate.environment) {
    return { ok: false, reason: "predicate missing level/environment" };
  }
  if (!Array.isArray(env.subject) || env.subject.length === 0) {
    return { ok: false, reason: "in-toto Statement requires at least one subject" };
  }
  return {
    ok: true,
    level: env.predicate.level,
    signed: false,
    format: "intoto",
    project: env.subject[0]?.name ?? "(unknown)",
    environment: env.predicate.environment,
  };
}
