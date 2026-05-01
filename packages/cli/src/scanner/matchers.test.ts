import { describe, expect, it } from "vitest";
import { scanText } from "./matchers.js";

describe("scanText", () => {
  it("detects process.env.NAME (Node dot access)", () => {
    const refs = scanText("const url = process.env.DATABASE_URL", "src/db.ts");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      name: "DATABASE_URL",
      confidence: "exact",
      matcher: "node:dot-access",
      line: 1,
    });
  });

  it("detects process.env['NAME'] (bracket string)", () => {
    const refs = scanText(`const k = process.env["API_KEY"]`, "f.ts");
    expect(refs).toHaveLength(1);
    expect(refs[0]?.name).toBe("API_KEY");
    expect(refs[0]?.matcher).toBe("node:bracket-string");
  });

  it("detects literal template like process.env[`STATIC_NAME`]", () => {
    const refs = scanText("process.env[`STATIC_NAME`]", "f.ts");
    expect(refs).toHaveLength(1);
    expect(refs[0]?.name).toBe("STATIC_NAME");
    expect(refs[0]?.confidence).toBe("exact");
  });

  it("flags interpolated template as template confidence", () => {
    const refs = scanText("process.env[`PREFIX_${name}`]", "f.ts");
    expect(refs).toHaveLength(1);
    expect(refs[0]?.confidence).toBe("template");
    expect(refs[0]?.name).toBeNull();
  });

  it("flags variable index as dynamic", () => {
    const refs = scanText("process.env[varName]", "f.ts");
    expect(refs).toHaveLength(1);
    expect(refs[0]?.confidence).toBe("dynamic");
    expect(refs[0]?.name).toBeNull();
  });

  it("detects import.meta.env.NAME (Vite)", () => {
    const refs = scanText("import.meta.env.VITE_API_URL", "f.ts");
    expect(refs[0]?.name).toBe("VITE_API_URL");
    expect(refs[0]?.matcher).toBe("vite:dot-access");
  });

  it("detects Deno.env.get('NAME')", () => {
    const refs = scanText(`Deno.env.get("HOST")`, "f.ts");
    expect(refs[0]?.name).toBe("HOST");
    expect(refs[0]?.matcher).toBe("deno:env-get");
  });

  it("detects Bun.env.NAME", () => {
    const refs = scanText("Bun.env.PORT", "f.ts");
    expect(refs[0]?.name).toBe("PORT");
  });

  it("respects // envmanifest-ignore-next-line", () => {
    const code = [
      "// envmanifest-ignore-next-line dynamic-env-name",
      "process.env[varName]",
      "process.env.OTHER",
    ].join("\n");
    const refs = scanText(code, "f.ts");
    expect(refs).toHaveLength(1);
    expect(refs[0]?.name).toBe("OTHER");
  });

  it("reports correct line numbers", () => {
    const code = ["", "", "const x = process.env.FOO"].join("\n");
    const refs = scanText(code, "f.ts");
    expect(refs[0]?.line).toBe(3);
  });

  it("returns refs sorted by line then column", () => {
    const code = [
      "process.env.B",
      "process.env.A",
    ].join("\n");
    const refs = scanText(code, "f.ts");
    expect(refs.map((r) => r.name)).toEqual(["B", "A"]);
  });

  it("detects multiple distinct names in one file", () => {
    const code =
      "const a = process.env.A; const b = process.env.B; const c = process.env.C;";
    const refs = scanText(code, "f.ts");
    const names = refs.map((r) => r.name);
    expect(names).toContain("A");
    expect(names).toContain("B");
    expect(names).toContain("C");
  });
});
