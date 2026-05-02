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

/**
 * Effective name = service.env_prefix + resource.name when both are set,
 * otherwise just resource.name. Aliases are NOT prefixed (plain alternates).
 */
export function effectiveName(
  resource: ManifestResource,
  manifest: Manifest,
): string {
  if (!resource.service) return resource.name;
  const svc = manifest.services?.find((s) => s.name === resource.service);
  if (!svc?.env_prefix) return resource.name;
  return svc.env_prefix + resource.name;
}
