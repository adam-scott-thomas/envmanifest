import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Manifest, ManifestResource } from "@envmanifest/schema";

const CANDIDATES = ["manifest.yml", "manifest.yaml", ".envmanifest.yml"];

export async function loadManifest(cwd: string): Promise<Manifest | null> {
  for (const c of CANDIDATES) {
    const full = join(cwd, c);
    try {
      const text = await readFile(full, "utf8");
      return parseYaml(text) as Manifest;
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
  return null;
}

export function resourcesFor(
  manifest: Manifest,
  env: string,
  service?: string,
): ManifestResource[] {
  return (manifest.resources ?? []).filter((r) => {
    if (!r.environments?.includes(env)) return false;
    if (service && r.service !== service) return false;
    return true;
  });
}
