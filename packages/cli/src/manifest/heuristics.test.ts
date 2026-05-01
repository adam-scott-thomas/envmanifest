import { describe, expect, it } from "vitest";
import { inferResource } from "./heuristics.js";

describe("inferResource", () => {
  it("classifies *_KEY as secret/server", () => {
    const r = inferResource("ANTHROPIC_API_KEY");
    expect(r.kind).toBe("secret");
    expect(r.exposure).toBe("server");
  });

  it("classifies NEXT_PUBLIC_* as env/public regardless of suffix", () => {
    const r = inferResource("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(r.kind).toBe("env");
    expect(r.exposure).toBe("public");
  });

  it("classifies VITE_* as public", () => {
    const r = inferResource("VITE_API_URL");
    expect(r.exposure).toBe("public");
    expect(r.type).toBe("url");
  });

  it("infers type=url from _URL suffix", () => {
    expect(inferResource("DATABASE_URL").type).toBe("url");
    expect(inferResource("REDIS_URI").type).toBe("url");
    expect(inferResource("API_ENDPOINT").type).toBe("url");
  });

  it("infers type=bool from ENABLE_/DISABLE_ prefix", () => {
    expect(inferResource("ENABLE_FEATURE_X").type).toBe("bool");
    expect(inferResource("DISABLE_CACHE").type).toBe("bool");
  });

  it("infers type=enum for LOG_LEVEL", () => {
    expect(inferResource("LOG_LEVEL").type).toBe("enum");
  });

  it("marks platform-injected vars as platform_generated and not required", () => {
    const r = inferResource("VERCEL_URL");
    expect(r.platform_generated).toBe(true);
    expect(r.required).toBe(false);
  });

  it("classifies *_TOKEN as secret", () => {
    expect(inferResource("SENTRY_AUTH_TOKEN").kind).toBe("secret");
  });

  it("classifies *_PASSWORD as secret", () => {
    expect(inferResource("DB_PASSWORD").kind).toBe("secret");
  });

  it("classifies generic env var as env/server", () => {
    const r = inferResource("FOO_BAR");
    expect(r.kind).toBe("env");
    expect(r.exposure).toBe("server");
  });
});
