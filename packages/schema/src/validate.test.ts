import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";
import { manifestSchemaV0 } from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");

describe("schema vs example", () => {
  it("manifest.example.v0.yml validates against manifest.schema.v0.json", async () => {
    const ajv = new Ajv2020.default({ strict: false, allErrors: true });
    addFormats.default(ajv);
    const validate = ajv.compile(manifestSchemaV0);

    const yamlText = await readFile(
      join(repoRoot, "examples", "manifest.example.v0.yml"),
      "utf8",
    );
    const data = parseYaml(yamlText);

    const ok = validate(data);
    if (!ok) {
      console.error("Schema validation errors:", validate.errors);
    }
    expect(ok).toBe(true);
  });
});
