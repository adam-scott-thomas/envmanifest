import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import kleur from "kleur";
import type { Manifest } from "@envmanifest/schema";
import { loadManifest, ManifestNotFoundError } from "../manifest/load.js";

interface RedactOptions {
  cwd: string;
  manifest?: string;
  out?: string;
  inPlace?: boolean;
}

const SENSITIVE_PATTERNS = [
  /SECRET/i,
  /KEY/i,
  /TOKEN/i,
  /PASSWORD/i,
  /PRIVATE/i,
  /CREDENTIAL/i,
  /AUTH/i,
];

export async function redactCommand(
  opts: RedactOptions,
  fileArg: string,
): Promise<void> {
  if (!fileArg) {
    console.error(kleur.red("✗ usage: envmanifest redact <file>"));
    process.exitCode = 1;
    return;
  }

  let manifest: Manifest | undefined;
  try {
    const loaded = await loadManifest(opts.cwd, opts.manifest);
    manifest = loaded.manifest;
  } catch (err) {
    if (!(err instanceof ManifestNotFoundError)) throw err;
  }

  const sensitiveNames = collectSensitiveNames(manifest);
  const path = isAbsolute(fileArg) ? fileArg : join(opts.cwd, fileArg);
  const text = await readFile(path, "utf8");
  const redacted = redactText(text, sensitiveNames);

  if (opts.inPlace) {
    await writeFile(path, redacted, "utf8");
    console.error(kleur.green("✓"), `redacted in place: ${path}`);
  } else if (opts.out) {
    const outPath = isAbsolute(opts.out) ? opts.out : join(opts.cwd, opts.out);
    await writeFile(outPath, redacted, "utf8");
    console.error(kleur.green("✓"), `wrote ${outPath}`);
  } else {
    process.stdout.write(redacted);
  }
}

function collectSensitiveNames(manifest: Manifest | undefined): Set<string> {
  const names = new Set<string>();
  if (manifest?.resources) {
    for (const r of manifest.resources) {
      if (r.kind === "secret") {
        names.add(r.name);
        for (const a of r.alias ?? []) names.add(a);
      }
    }
  }
  return names;
}

export function redactText(text: string, manifestSecrets: Set<string>): string {
  const lines = text.split(/\r?\n/);
  const redacted = lines.map((line) => redactLine(line, manifestSecrets));
  return redacted.join("\n");
}

function redactLine(line: string, manifestSecrets: Set<string>): string {
  // Pattern 1: NAME=value (dotenv style)
  const dotenv = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/;
  const m1 = dotenv.exec(line);
  if (m1) {
    const name = m1[2] ?? "";
    if (isSensitive(name, manifestSecrets)) {
      return `${m1[1]}${name}${m1[3]}***REDACTED***`;
    }
    return line;
  }

  // Pattern 2: "NAME": "value" (JSON-ish)
  const jsonish = /^(\s*"?)([A-Za-z_][A-Za-z0-9_]*)("?\s*:\s*)(["'`].*["'`]),?\s*$/;
  const m2 = jsonish.exec(line);
  if (m2) {
    const name = m2[2] ?? "";
    if (isSensitive(name, manifestSecrets)) {
      const ending = line.endsWith(",") ? "," : "";
      return `${m2[1]}${name}${m2[3]}"***REDACTED***"${ending}`;
    }
    return line;
  }

  return line;
}

function isSensitive(name: string, manifestSecrets: Set<string>): boolean {
  if (manifestSecrets.has(name)) return true;
  return SENSITIVE_PATTERNS.some((re) => re.test(name));
}
