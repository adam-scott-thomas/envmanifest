import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Manifest } from "@envmanifest/schema";

export class ManifestNotFoundError extends Error {
  constructor(public readonly path: string) {
    super(`No manifest.yml found at ${path}`);
    this.name = "ManifestNotFoundError";
  }
}

export async function loadManifest(cwd: string): Promise<{
  manifest: Manifest;
  path: string;
  source: string;
}> {
  const candidates = ["manifest.yml", "manifest.yaml", ".envmanifest.yml"];
  for (const candidate of candidates) {
    const full = join(cwd, candidate);
    try {
      const source = await readFile(full, "utf8");
      const parsed = parseYaml(source) as Manifest;
      return { manifest: parsed, path: full, source };
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "ENOENT"
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new ManifestNotFoundError(cwd);
}
