import kleur from "kleur";
import { scan } from "../scanner/index.js";
import { loadManifest, ManifestNotFoundError } from "../manifest/load.js";
import { discoverDotenvFiles } from "../dotenv/parse.js";
import { reconcile } from "../manifest/reconcile.js";

interface CheckOptions {
  cwd: string;
  env: string;
}

export async function checkCommand(opts: CheckOptions): Promise<void> {
  let manifest;
  try {
    const loaded = await loadManifest(opts.cwd);
    manifest = loaded.manifest;
    console.log(kleur.dim(`manifest: ${loaded.path}`));
  } catch (err) {
    if (err instanceof ManifestNotFoundError) {
      console.error(kleur.red("✗ no manifest.yml found"));
      console.error(kleur.dim("  run 'envmanifest init' to create one"));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const [scanResult, dotenv] = await Promise.all([
    scan({ cwd: opts.cwd }),
    discoverDotenvFiles(opts.cwd, opts.env),
  ]);

  if (dotenv.found.length === 0) {
    console.log(kleur.dim(`dotenv: none found for env=${opts.env}`));
  } else {
    for (const f of dotenv.found) {
      console.log(kleur.dim(`dotenv: ${f.path} (${f.names.size} names)`));
    }
  }
  console.log(
    kleur.dim(
      `scanner: ${scanResult.filesScanned} files, ` +
        `${new Set(scanResult.references.map((r) => r.name).filter(Boolean)).size} distinct names`,
    ),
  );
  console.log();

  const findings = reconcile({
    env: opts.env,
    manifest,
    refs: scanResult.references,
    dotenvFiles: dotenv.found,
  });

  if (findings.length === 0) {
    console.log(kleur.green("✓ manifest is consistent with code and .env files"));
    return;
  }

  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warning");
  const infos = findings.filter((f) => f.severity === "info");

  for (const f of findings) {
    const icon =
      f.severity === "error" ? kleur.red("✗") : f.severity === "warning" ? kleur.yellow("!") : kleur.cyan("·");
    const namePart = f.name ? kleur.bold(f.name) + " " : "";
    console.log(`${icon} ${namePart}${kleur.dim(`[${f.code}]`)} ${f.message}`);
    if (f.hint) console.log(kleur.dim(`    → ${f.hint}`));
  }

  console.log();
  console.log(
    kleur.dim(
      `${errors.length} error${errors.length === 1 ? "" : "s"}, ` +
        `${warnings.length} warning${warnings.length === 1 ? "" : "s"}, ` +
        `${infos.length} info`,
    ),
  );

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}
