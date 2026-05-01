import { describe, expect, it } from "vitest";
import { renderSarif } from "./sarif.js";
import type { Finding } from "../manifest/reconcile.js";

describe("renderSarif", () => {
  it("renders SARIF v2.1.0 with $schema and version", () => {
    const out = renderSarif({ findings: [], toolVersion: "0.0.0" });
    const parsed = JSON.parse(out);
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.$schema).toContain("sarif-schema-2.1.0");
    expect(parsed.runs).toHaveLength(1);
  });

  it("includes only rules referenced by findings", () => {
    const findings: Finding[] = [
      { severity: "error", code: "code.undeclared", name: "X", message: "X missing" },
    ];
    const parsed = JSON.parse(renderSarif({ findings, toolVersion: "0.0.0" }));
    const ids = (parsed.runs[0].tool.driver.rules as Array<{ id: string }>).map(
      (r) => r.id,
    );
    expect(ids).toEqual(["code.undeclared"]);
  });

  it("maps severities to SARIF levels", () => {
    const findings: Finding[] = [
      { severity: "error", code: "code.undeclared", name: "A", message: "" },
      { severity: "warning", code: "dotenv.undeclared", name: "B", message: "" },
      { severity: "info", code: "manifest.unused", name: "C", message: "" },
    ];
    const parsed = JSON.parse(renderSarif({ findings, toolVersion: "0.0.0" }));
    const levels = (parsed.runs[0].results as Array<{ level: string }>).map(
      (r) => r.level,
    );
    expect(levels).toEqual(["error", "warning", "note"]);
  });

  it("prefixes message with name when name is present", () => {
    const findings: Finding[] = [
      { severity: "error", code: "code.undeclared", name: "API_KEY", message: "missing" },
    ];
    const parsed = JSON.parse(renderSarif({ findings, toolVersion: "0.0.0" }));
    expect(parsed.runs[0].results[0].message.text).toBe("API_KEY: missing");
  });

  it("dedupes rules across multiple findings of the same code", () => {
    const findings: Finding[] = [
      { severity: "error", code: "code.undeclared", name: "A", message: "" },
      { severity: "error", code: "code.undeclared", name: "B", message: "" },
    ];
    const parsed = JSON.parse(renderSarif({ findings, toolVersion: "0.0.0" }));
    expect(parsed.runs[0].tool.driver.rules).toHaveLength(1);
    expect(parsed.runs[0].results).toHaveLength(2);
  });

  it("emits valid JSON parseable by standard JSON.parse", () => {
    const out = renderSarif({
      findings: [{ severity: "error", code: "code.undeclared", name: "X", message: "y" }],
      toolVersion: "0.1.2",
    });
    expect(() => JSON.parse(out)).not.toThrow();
  });
});
