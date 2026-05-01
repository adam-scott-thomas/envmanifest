import { describe, expect, it } from "vitest";
import { defineEnv, EnvLoadError } from "./index.js";

describe("defineEnv", () => {
  it("returns a proxy that exposes required keys", () => {
    const env = defineEnv({
      required: ["DATABASE_URL"] as const,
      source: { DATABASE_URL: "postgres://x" },
    });
    expect(env.DATABASE_URL).toBe("postgres://x");
  });

  it("throws EnvLoadError on missing required keys", () => {
    expect(() =>
      defineEnv({
        required: ["DATABASE_URL", "API_KEY"] as const,
        source: {},
      }),
    ).toThrow(EnvLoadError);
  });

  it("treats empty string as missing", () => {
    expect(() =>
      defineEnv({
        required: ["X"] as const,
        source: { X: "" },
      }),
    ).toThrow(/missing required env vars: X/);
  });

  it("includes project in error message when provided", () => {
    try {
      defineEnv({
        required: ["X"] as const,
        source: {},
        project: "my-app",
      });
    } catch (err) {
      expect((err as Error).message).toContain("[my-app]");
      return;
    }
    throw new Error("expected throw");
  });

  it("allows access to optional keys without throwing", () => {
    const env = defineEnv({
      required: [] as const,
      source: { LOG_LEVEL: "info" },
    });
    expect(env["LOG_LEVEL"]).toBe("info");
    expect(env["MISSING"]).toBeUndefined();
  });
});
