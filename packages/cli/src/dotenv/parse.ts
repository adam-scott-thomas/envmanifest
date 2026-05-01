import { readFile } from "node:fs/promises";
import { join } from "node:path";

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;

export interface DotenvFile {
  path: string;
  names: Set<string>;
}

export async function loadDotenvFile(absPath: string): Promise<DotenvFile | null> {
  let text: string;
  try {
    text = await readFile(absPath, "utf8");
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }
    throw err;
  }

  const names = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = LINE.exec(line);
    if (m && m[1]) names.add(m[1]);
  }
  return { path: absPath, names };
}

export interface DotenvDiscovery {
  found: DotenvFile[];
  searched: string[];
}

export async function discoverDotenvFiles(
  cwd: string,
  env: string,
): Promise<DotenvDiscovery> {
  const candidates = dotenvCandidatesFor(env);
  const searched: string[] = [];
  const found: DotenvFile[] = [];
  for (const name of candidates) {
    const full = join(cwd, name);
    searched.push(full);
    const parsed = await loadDotenvFile(full);
    if (parsed) found.push(parsed);
  }
  return { found, searched };
}

export function dotenvCandidatesFor(env: string): string[] {
  if (env === "local" || env === "development" || env === "dev") {
    return [".env", ".env.local", ".env.development", ".env.development.local"];
  }
  return [".env", `.env.${env}`, `.env.${env}.local`];
}
