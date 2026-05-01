import { describe, expect, it } from "vitest";
import { reconcile } from "./reconcile.js";
import type { Manifest, ManifestResource } from "@envmanifest/schema";
import type { ConfigReference } from "../scanner/types.js";

function ref(name: string, file = "src/x.ts"): ConfigReference {
  return {
    name,
    raw: `process.env.${name}`,
    confidence: "exact",
    file,
    line: 1,
    column: 1,
    matcher: "node:dot-access",
  };
}

function resource(
  name: string,
  partial: Partial<ManifestResource> = {},
): ManifestResource {
  return {
    name,
    kind: "env",
    exposure: "server",
    phase: ["runtime"],
    environments: ["local", "production"],
    ...partial,
  };
}

function manifest(resources: ManifestResource[]): Manifest {
  return {
    version: 0,
    project: "test",
    environments: ["local", "production"],
    resources,
  };
}

describe("reconcile", () => {
  it("returns no findings when manifest, code, and .env all agree", () => {
    const m = manifest([resource("FOO")]);
    const findings = reconcile({
      env: "local",
      manifest: m,
      refs: [ref("FOO")],
      dotenvFiles: [{ path: ".env", names: new Set(["FOO"]) }],
    });
    expect(findings).toHaveLength(0);
  });

  it("flags code references not declared in manifest", () => {
    const m = manifest([resource("FOO")]);
    const findings = reconcile({
      env: "local",
      manifest: m,
      refs: [ref("FOO"), ref("UNDECLARED")],
      dotenvFiles: [{ path: ".env", names: new Set(["FOO", "UNDECLARED"]) }],
    });
    const codes = findings.map((f) => f.code);
    expect(codes).toContain("code.undeclared");
    expect(findings.find((f) => f.code === "code.undeclared")?.name).toBe(
      "UNDECLARED",
    );
  });

  it("flags .env names not declared in manifest", () => {
    const m = manifest([resource("FOO")]);
    const findings = reconcile({
      env: "local",
      manifest: m,
      refs: [ref("FOO")],
      dotenvFiles: [{ path: ".env", names: new Set(["FOO", "EXTRA"]) }],
    });
    expect(findings.find((f) => f.code === "dotenv.undeclared")?.name).toBe(
      "EXTRA",
    );
  });

  it("flags missing required vars in dev/local", () => {
    const m = manifest([resource("DATABASE_URL")]);
    const findings = reconcile({
      env: "local",
      manifest: m,
      refs: [ref("DATABASE_URL")],
      dotenvFiles: [{ path: ".env", names: new Set() }],
    });
    expect(findings.find((f) => f.code === "dotenv.missing")?.name).toBe(
      "DATABASE_URL",
    );
  });

  it("flags 'never_in' policy violations", () => {
    const m = manifest([
      resource("SEED_DB", {
        environments: ["local", "production"],
        never_in: ["production"],
      }),
    ]);
    const findings = reconcile({
      env: "production",
      manifest: m,
      refs: [],
      dotenvFiles: [{ path: ".env.production", names: new Set(["SEED_DB"]) }],
    });
    const f = findings.find((f) => f.code === "policy.forbidden");
    expect(f?.name).toBe("SEED_DB");
    expect(f?.severity).toBe("error");
  });

  it("respects required: false (no missing finding)", () => {
    const m = manifest([resource("OPTIONAL", { required: false })]);
    const findings = reconcile({
      env: "local",
      manifest: m,
      refs: [],
      dotenvFiles: [{ path: ".env", names: new Set() }],
    });
    expect(findings.find((f) => f.code === "dotenv.missing")).toBeUndefined();
  });

  it("treats aliases as equivalent when reconciling", () => {
    const m = manifest([
      resource("REDIS_URL", {
        alias: ["CACHE_URL"],
        environments: ["local"],
      }),
    ]);
    const findings = reconcile({
      env: "local",
      manifest: m,
      refs: [ref("CACHE_URL")],
      dotenvFiles: [{ path: ".env", names: new Set(["CACHE_URL"]) }],
    });
    expect(findings.find((f) => f.code === "code.undeclared")).toBeUndefined();
    expect(findings.find((f) => f.code === "dotenv.missing")).toBeUndefined();
  });

  it("ignores resources whose environments do not include the active env", () => {
    const m = manifest([
      resource("PROD_ONLY", { environments: ["production"] }),
    ]);
    const findings = reconcile({
      env: "local",
      manifest: m,
      refs: [],
      dotenvFiles: [{ path: ".env", names: new Set() }],
    });
    expect(findings.find((f) => f.code === "dotenv.missing")).toBeUndefined();
  });

  it("does not require platform_generated resources to be in .env", () => {
    const m = manifest([
      resource("VERCEL_URL", {
        platform_generated: true,
        environments: ["local", "production"],
      }),
    ]);
    const findings = reconcile({
      env: "local",
      manifest: m,
      refs: [],
      dotenvFiles: [{ path: ".env", names: new Set() }],
    });
    expect(findings.find((f) => f.code === "dotenv.missing")).toBeUndefined();
  });

  it("emits info-level finding for declared-but-unused resources", () => {
    const m = manifest([resource("UNUSED")]);
    const findings = reconcile({
      env: "local",
      manifest: m,
      refs: [],
      dotenvFiles: [{ path: ".env", names: new Set(["UNUSED"]) }],
    });
    const f = findings.find((ff) => ff.code === "manifest.unused");
    expect(f?.severity).toBe("info");
    expect(f?.name).toBe("UNUSED");
  });

  it("sorts findings: errors first, then warnings, then info", () => {
    const m = manifest([resource("A"), resource("B"), resource("C")]);
    const findings = reconcile({
      env: "local",
      manifest: m,
      refs: [ref("A"), ref("UNDECLARED")],
      dotenvFiles: [{ path: ".env", names: new Set(["A", "EXTRA"]) }],
    });
    const severities = findings.map((f) => f.severity);
    expect(severities[0]).toBe("error");
    const lastError = severities.lastIndexOf("error");
    const firstWarning = severities.indexOf("warning");
    if (firstWarning !== -1) expect(firstWarning).toBeGreaterThan(lastError);
  });
});
