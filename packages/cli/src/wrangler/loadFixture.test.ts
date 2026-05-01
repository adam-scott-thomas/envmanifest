import { describe, expect, it } from "vitest";
import { mkdtemp, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadWranglerConfig } from "./parse.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "..", "tests", "fixtures");

async function stage(fixtureName: string, asName: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "envm-wrangler-"));
  await copyFile(join(fixtures, fixtureName), join(dir, asName));
  return dir;
}

describe("loadWranglerConfig (file)", () => {
  it("loads a JSONC config", async () => {
    const cwd = await stage("wrangler-full.jsonc", "wrangler.jsonc");
    const config = await loadWranglerConfig(cwd);
    expect(config).not.toBeNull();
    expect(config?.format).toBe("jsonc");
    const names = config!.bindings.map((b) => b.name).sort();
    expect(names).toEqual([
      "AI",
      "ASSETS",
      "AUTH_SVC",
      "BUCKET",
      "DB",
      "EMBEDDINGS",
      "JOBS",
      "ROOMS",
      "SESSIONS",
    ]);
  });

  it("loads a TOML config", async () => {
    const cwd = await stage("wrangler-minimal.toml", "wrangler.toml");
    const config = await loadWranglerConfig(cwd);
    expect(config).not.toBeNull();
    expect(config?.format).toBe("toml");
    const names = config!.bindings.map((b) => b.name).sort();
    expect(names).toEqual(["AI", "ASSETS", "DB"]);
  });

  it("returns null when no wrangler config is present", async () => {
    const dir = await mkdtemp(join(tmpdir(), "envm-wrangler-empty-"));
    const config = await loadWranglerConfig(dir);
    expect(config).toBeNull();
  });

  it("classifies r2 vs d1 vs kv vs ai providers correctly", async () => {
    const cwd = await stage("wrangler-minimal.toml", "wrangler.toml");
    const config = await loadWranglerConfig(cwd);
    const byName = new Map(config!.bindings.map((b) => [b.name, b]));
    expect(byName.get("ASSETS")?.provider).toBe("cloudflare-r2");
    expect(byName.get("DB")?.provider).toBe("cloudflare-d1");
    expect(byName.get("AI")?.provider).toBe("cloudflare-ai");
  });
});
