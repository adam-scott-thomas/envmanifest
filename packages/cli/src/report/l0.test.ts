import { describe, expect, it } from "vitest";
import { buildL0Report } from "./l0.js";
import { buildInTotoStatement } from "./intoto.js";
import { keySetHash, manifestHash, sha256Hex } from "./hash.js";
import type { Manifest } from "@envmanifest/schema";

const manifest: Manifest = {
  version: 0,
  project: "p",
  environments: ["local"],
  resources: [
    {
      name: "FOO",
      kind: "env",
      exposure: "server",
      phase: ["runtime"],
      environments: ["local"],
    },
  ],
};

describe("L0 report", () => {
  it("includes deterministic manifest_hash and key_set_hash", () => {
    const r = buildL0Report({
      manifest,
      manifestSource: "version: 0\nproject: p\n",
      env: "local",
      findings: [],
      presentNames: ["B", "A"],
      cliVersion: "0.0.0",
      observedAt: new Date("2026-05-01T00:00:00Z"),
    });
    expect(r.manifest_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(r.key_set_hash).toBe(keySetHash(["A", "B"])); // sorted
  });

  it("required_present=false when dotenv.missing error exists", () => {
    const r = buildL0Report({
      manifest,
      manifestSource: "x",
      env: "local",
      findings: [
        { severity: "error", code: "dotenv.missing", name: "FOO", message: "x" },
      ],
      presentNames: [],
      cliVersion: "0.0.0",
    });
    expect(r.required_present).toBe(false);
  });

  it("required_present=true when no missing-vars error", () => {
    const r = buildL0Report({
      manifest,
      manifestSource: "x",
      env: "local",
      findings: [
        { severity: "warning", code: "dotenv.undeclared", message: "x" },
      ],
      presentNames: ["FOO"],
      cliVersion: "0.0.0",
    });
    expect(r.required_present).toBe(true);
  });

  it("uses level=L0 and signed=false", () => {
    const r = buildL0Report({
      manifest,
      manifestSource: "x",
      env: "local",
      findings: [],
      presentNames: [],
      cliVersion: "0.0.0",
    });
    expect(r.level).toBe("L0");
    expect(r.signed).toBe(false);
  });
});

describe("in-toto statement", () => {
  it("wraps L0 report in in-toto v1 envelope", () => {
    const l0 = buildL0Report({
      manifest,
      manifestSource: "x",
      env: "local",
      findings: [],
      presentNames: ["FOO"],
      cliVersion: "0.0.0",
      observedAt: new Date("2026-05-01T00:00:00Z"),
    });
    const stmt = buildInTotoStatement({ l0 });
    expect(stmt._type).toBe("https://in-toto.io/Statement/v1");
    expect(stmt.predicateType).toBe("https://envmanifest.dev/attestation/v1");
    expect(stmt.predicate.manifest_hash).toBe(l0.manifest_hash);
    expect(stmt.subject).toHaveLength(1);
    expect(stmt.subject[0]?.name).toBe("p");
  });

  it("uses provided subjects when given", () => {
    const l0 = buildL0Report({
      manifest,
      manifestSource: "x",
      env: "local",
      findings: [],
      presentNames: [],
      cliVersion: "0.0.0",
    });
    const stmt = buildInTotoStatement({
      l0,
      subjects: [
        { name: "github.com/me/repo", digest: { gitCommit: "abc123" } },
      ],
    });
    expect(stmt.subject[0]?.name).toBe("github.com/me/repo");
    expect(stmt.subject[0]?.digest["gitCommit"]).toBe("abc123");
  });
});

describe("hash helpers", () => {
  it("manifestHash normalizes line endings", () => {
    expect(manifestHash("a: 1\r\nb: 2")).toBe(manifestHash("a: 1\nb: 2\n"));
  });

  it("keySetHash is order-independent", () => {
    expect(keySetHash(["A", "B"])).toBe(keySetHash(["B", "A"]));
  });

  it("keySetHash dedupes", () => {
    expect(keySetHash(["A", "A", "B"])).toBe(keySetHash(["A", "B"]));
  });

  it("sha256Hex is deterministic", () => {
    expect(sha256Hex("foo")).toBe(sha256Hex("foo"));
  });
});
