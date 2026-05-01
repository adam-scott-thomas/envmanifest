import { describe, expect, it } from "vitest";
import { redactText } from "./redact.js";

describe("redactText", () => {
  it("masks dotenv-style sensitive values", () => {
    const out = redactText("API_KEY=sk_live_abc123", new Set());
    expect(out).toBe("API_KEY=***REDACTED***");
  });

  it("masks names found in the manifest's secret set", () => {
    const out = redactText("MY_SAFE_VAR=abc", new Set(["MY_SAFE_VAR"]));
    expect(out).toBe("MY_SAFE_VAR=***REDACTED***");
  });

  it("preserves non-sensitive dotenv lines unchanged", () => {
    expect(redactText("PORT=3000", new Set())).toBe("PORT=3000");
    expect(redactText("LOG_LEVEL=debug", new Set())).toBe("LOG_LEVEL=debug");
  });

  it("handles 'export' prefix", () => {
    const out = redactText("export DATABASE_PASSWORD=hunter2", new Set());
    expect(out).toBe("export DATABASE_PASSWORD=***REDACTED***");
  });

  it("masks JSON-style sensitive values", () => {
    const out = redactText(`  "STRIPE_SECRET_KEY": "sk_live_xxx",`, new Set());
    expect(out).toBe(`  "STRIPE_SECRET_KEY": "***REDACTED***",`);
  });

  it("handles multiline files", () => {
    const input = [
      "DATABASE_URL=postgres://x",
      "API_KEY=sk_abc",
      "PORT=3000",
      "",
      "# comment",
    ].join("\n");
    const out = redactText(input, new Set(["DATABASE_URL"]));
    expect(out.split("\n")).toEqual([
      "DATABASE_URL=***REDACTED***",
      "API_KEY=***REDACTED***",
      "PORT=3000",
      "",
      "# comment",
    ]);
  });

  it("matches all default sensitive patterns", () => {
    for (const name of [
      "FOO_KEY",
      "FOO_TOKEN",
      "FOO_SECRET",
      "FOO_PASSWORD",
      "FOO_PRIVATE",
      "FOO_CREDENTIAL",
      "FOO_AUTH",
    ]) {
      const out = redactText(`${name}=sensitive`, new Set());
      expect(out).toBe(`${name}=***REDACTED***`);
    }
  });

  it("does NOT redact comments that mention secrets", () => {
    expect(redactText("# put your API_KEY here", new Set())).toBe(
      "# put your API_KEY here",
    );
  });
});
