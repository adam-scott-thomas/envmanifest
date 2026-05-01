import { describe, expect, it } from "vitest";
import { isSensitiveName, redactName } from "./redact.js";

describe("isSensitiveName", () => {
  it.each([
    "STRIPE_SECRET_KEY",
    "API_KEY",
    "GITHUB_TOKEN",
    "DB_PASSWORD",
    "PRIVATE_KEY",
    "BASIC_AUTH",
  ])("flags %s as sensitive", (name) => {
    expect(isSensitiveName(name)).toBe(true);
  });

  it.each(["DATABASE_URL", "LOG_LEVEL", "PORT", "NODE_ENV"])(
    "treats %s as not sensitive",
    (name) => {
      expect(isSensitiveName(name)).toBe(false);
    },
  );
});

describe("redactName", () => {
  it("returns name unchanged when level=off", () => {
    expect(redactName("STRIPE_SECRET_KEY", "off")).toBe("STRIPE_SECRET_KEY");
  });

  it("returns <redacted> when level=full", () => {
    expect(redactName("FOO", "full")).toBe("<redacted>");
    expect(redactName("DATABASE_URL", "full")).toBe("<redacted>");
  });

  it("partial mode keeps non-sensitive names whole", () => {
    expect(redactName("DATABASE_URL", "partial")).toBe("DATABASE_URL");
  });

  it("partial mode masks sensitive long names with prefix...", () => {
    expect(redactName("STRIPE_SECRET_KEY", "partial")).toBe("STR...");
  });

  it("partial mode fully masks short sensitive names", () => {
    expect(redactName("KEY", "partial")).toBe("***");
  });
});
