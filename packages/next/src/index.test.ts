import { describe, expect, it } from "vitest";
import { createEnv, EnvLoadError } from "./index.js";

describe("createEnv (Next.js)", () => {
  it("returns typed env on the server when all required keys present", () => {
    const env = createEnv({
      server: ["DATABASE_URL"] as const,
      client: ["NEXT_PUBLIC_APP_URL"] as const,
      isServer: true,
      source: {
        DATABASE_URL: "postgres://x",
        NEXT_PUBLIC_APP_URL: "https://y.com",
      },
    });
    expect(env.DATABASE_URL).toBe("postgres://x");
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://y.com");
  });

  it("throws if a non-NEXT_PUBLIC_ name is in 'client'", () => {
    expect(() =>
      createEnv({
        server: [] as const,
        client: ["DATABASE_URL"] as const,
        isServer: true,
        source: { DATABASE_URL: "x" },
      }),
    ).toThrow(/does not start with NEXT_PUBLIC_/);
  });

  it("throws if a server-only var is accessed on the client", () => {
    expect(() =>
      createEnv({
        server: ["DATABASE_URL"] as const,
        client: [] as const,
        isServer: false,
        source: { DATABASE_URL: "x" },
      }),
    ).toThrow(/'server' but accessed on the client/);
  });

  it("does NOT throw on the client when 'server' contains only NEXT_PUBLIC_ names", () => {
    const env = createEnv({
      server: ["NEXT_PUBLIC_X"] as const,
      client: ["NEXT_PUBLIC_Y"] as const,
      isServer: false,
      source: { NEXT_PUBLIC_X: "x", NEXT_PUBLIC_Y: "y" },
    });
    expect(env.NEXT_PUBLIC_Y).toBe("y");
  });

  it("throws EnvLoadError on missing required vars", () => {
    expect(() =>
      createEnv({
        server: ["DATABASE_URL"] as const,
        client: [] as const,
        isServer: true,
        source: {},
      }),
    ).toThrow(EnvLoadError);
  });
});
