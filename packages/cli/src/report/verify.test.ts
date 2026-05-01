import { describe, expect, it } from "vitest";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildL0Report } from "./l0.js";
import { buildInTotoStatement } from "./intoto.js";
import { verifyFile } from "./verify.js";
import type { Manifest } from "@envmanifest/schema";

const m: Manifest = {
  version: 0,
  project: "p",
  environments: ["local"],
  resources: [],
};

async function withTempFile(
  content: string,
  fn: (path: string) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "envm-verify-"));
  const path = join(dir, "seal.json");
  await writeFile(path, content, "utf8");
  await fn(path);
}

describe("verify-seal", () => {
  it("accepts a fresh L0 report", async () => {
    const report = buildL0Report({
      manifest: m,
      manifestSource: "x\n",
      env: "local",
      findings: [],
      presentNames: [],
      cliVersion: "0.0.0",
    });
    await withTempFile(JSON.stringify(report), async (path) => {
      const result = await verifyFile(path);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.level).toBe("L0");
        expect(result.format).toBe("l0");
        expect(result.signed).toBe(false);
      }
    });
  });

  it("accepts a fresh in-toto Statement", async () => {
    const l0 = buildL0Report({
      manifest: m,
      manifestSource: "x\n",
      env: "local",
      findings: [],
      presentNames: [],
      cliVersion: "0.0.0",
    });
    const stmt = buildInTotoStatement({ l0 });
    await withTempFile(JSON.stringify(stmt), async (path) => {
      const result = await verifyFile(path);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.format).toBe("intoto");
        expect(result.environment).toBe("local");
      }
    });
  });

  it("rejects malformed JSON", async () => {
    await withTempFile("not json", async (path) => {
      const result = await verifyFile(path);
      expect(result.ok).toBe(false);
    });
  });

  it("rejects unrecognized format", async () => {
    await withTempFile(JSON.stringify({ hello: "world" }), async (path) => {
      const result = await verifyFile(path);
      expect(result.ok).toBe(false);
    });
  });

  it("rejects L0 with malformed manifest_hash", async () => {
    const bad = {
      schema: "envmanifest.l0",
      schema_version: 1,
      level: "L0",
      signed: false,
      project: "p",
      environment: "local",
      manifest_hash: "not-a-hash",
      key_set_hash: "sha256:" + "0".repeat(64),
      required_present: true,
      drift: [],
      observed_at: "2026-05-01T00:00:00Z",
      cli_version: "0.0.0",
    };
    await withTempFile(JSON.stringify(bad), async (path) => {
      const result = await verifyFile(path);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/manifest_hash/);
    });
  });

  it("rejects in-toto with unexpected predicateType", async () => {
    const bad = {
      _type: "https://in-toto.io/Statement/v1",
      predicateType: "https://other.example/v1",
      subject: [{ name: "p", digest: { sha256: "x" } }],
      predicate: { level: "L0", environment: "local" },
    };
    await withTempFile(JSON.stringify(bad), async (path) => {
      const result = await verifyFile(path);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/predicateType/);
    });
  });
});
