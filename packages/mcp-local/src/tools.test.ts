import { describe, expect, it } from "vitest";
import type { Manifest, ManifestResource } from "@envmanifest/schema";
import {
  explainRequirement,
  listMissing,
  listRequired,
  resolveSource,
  validate,
  type ToolContext,
} from "./tools.js";
import { resolvePolicy } from "./policy.js";

function r(name: string, partial: Partial<ManifestResource> = {}): ManifestResource {
  return {
    name,
    kind: "env",
    exposure: "server",
    phase: ["runtime"],
    environments: ["local", "production"],
    ...partial,
  };
}

function m(resources: ManifestResource[], policyOverride?: object): Manifest {
  const out: Manifest = {
    version: 0,
    project: "t",
    environments: ["local", "production"],
    resources,
  };
  if (policyOverride) {
    (out as Manifest).policies = { mcp: policyOverride } as Manifest["policies"];
  }
  return out;
}

function ctx(manifest: Manifest): ToolContext {
  return { manifest, policy: resolvePolicy(manifest) };
}

describe("listRequired", () => {
  it("returns required resources for the env", () => {
    const c = ctx(
      m([
        r("FOO"),
        r("BAR", { required: false }),
        r("PROD_ONLY", { environments: ["production"] }),
      ]),
    );
    const out = listRequired(c, { env: "local" });
    expect(out.resources.map((x) => x.name)).toEqual(["FOO"]);
  });

  it("filters by service when given", () => {
    const c = ctx(m([r("API_X", { service: "api" }), r("WEB_X", { service: "web" })]));
    const out = listRequired(c, { env: "local", service: "api" });
    expect(out.resources.map((x) => x.name)).toEqual(["API_X"]);
  });

  it("redacts sensitive names by default (partial)", () => {
    const c = ctx(m([r("STRIPE_SECRET_KEY", { kind: "secret" })]));
    const out = listRequired(c, { env: "local" });
    expect(out.resources[0]?.name).toBe("STR...");
  });
});

describe("validate", () => {
  it("ok=true when all required names present", () => {
    const c = ctx(m([r("FOO")]));
    const out = validate(c, { env: "local", presentNames: ["FOO"] });
    expect(out.ok).toBe(true);
    expect(out.missing).toEqual([]);
  });

  it("reports missing", () => {
    const c = ctx(m([r("FOO"), r("BAR")]));
    const out = validate(c, { env: "local", presentNames: ["FOO"] });
    expect(out.ok).toBe(false);
    expect(out.missing).toContain("BAR");
  });

  it("reports unknown names", () => {
    const c = ctx(m([r("FOO")]));
    const out = validate(c, {
      env: "local",
      presentNames: ["FOO", "EXTRA"],
    });
    expect(out.unknown).toContain("EXTRA");
  });

  it("reports forbidden when never_in matches active env", () => {
    const c = ctx(
      m([
        r("SEED_DB", {
          environments: ["local", "production"],
          never_in: ["production"],
        }),
      ]),
    );
    const out = validate(c, {
      env: "production",
      presentNames: ["SEED_DB"],
    });
    expect(out.forbidden).toContain("SEED_DB");
  });

  it("respects aliases", () => {
    const c = ctx(m([r("REDIS_URL", { alias: ["CACHE_URL"] })]));
    const out = validate(c, {
      env: "local",
      presentNames: ["CACHE_URL"],
    });
    expect(out.ok).toBe(true);
  });
});

describe("explainRequirement", () => {
  it("returns metadata for declared resource", () => {
    const c = ctx(m([r("FOO", { type: "url", description: "the foo" })]));
    const out = explainRequirement(c, { name: "FOO" });
    expect(out.found).toBe(true);
    expect(out.resource?.type).toBe("url");
    expect(out.resource?.description).toBe("the foo");
  });

  it("returns found=false for unknown name", () => {
    const c = ctx(m([r("FOO")]));
    expect(explainRequirement(c, { name: "BAR" }).found).toBe(false);
  });

  it("resolves via alias", () => {
    const c = ctx(m([r("REDIS_URL", { alias: ["CACHE_URL"] })]));
    expect(explainRequirement(c, { name: "CACHE_URL" }).found).toBe(true);
  });
});

describe("resolveSource", () => {
  it("returns provider list for declared resource in env", () => {
    const c = ctx(
      m([
        r("DB_URL", {
          sources: [
            { provider: "aws-secrets-manager", ref: "aws-sm://prod/db", environments: ["production"] },
            { provider: "dotenv", environments: ["local"] },
          ],
        }),
      ]),
    );
    const local = resolveSource(c, { name: "DB_URL", env: "local" });
    expect(local.sources.map((s) => s.provider)).toEqual(["dotenv"]);
    const prod = resolveSource(c, { name: "DB_URL", env: "production" });
    expect(prod.sources.map((s) => s.provider)).toEqual(["aws-secrets-manager"]);
  });

  it("returns found=false for unknown", () => {
    const c = ctx(m([r("FOO")]));
    expect(resolveSource(c, { name: "MISSING", env: "local" }).found).toBe(false);
  });
});

describe("listMissing", () => {
  it("returns names that are required but absent", () => {
    const c = ctx(m([r("A"), r("B"), r("C")]));
    const out = listMissing(c, {
      env: "local",
      presentNames: ["A"],
    });
    expect(out.missing.sort()).toEqual(["B", "C"]);
  });
});
