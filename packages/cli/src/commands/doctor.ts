import kleur from "kleur";
import { scan } from "../scanner/index.js";
import { loadManifest, ManifestNotFoundError } from "../manifest/load.js";
import { discoverDotenvFiles } from "../dotenv/parse.js";
import { reconcile, type Finding } from "../manifest/reconcile.js";

interface DoctorOptions {
  cwd: string;
  env?: string;
  manifest?: string;
}

const EXPLAIN: Record<string, string> = {
  "code.undeclared":
    "Your code reads this env var, but the manifest doesn't list it. Add it to manifest.yml so the contract matches reality.",
  "dotenv.undeclared":
    "This name appears in a .env file but isn't in the manifest. Either declare it, or remove it from .env if it's stale.",
  "dotenv.missing":
    "The manifest requires this for the active env, but no .env file provides it. Set it in .env (or .env.local) before running locally.",
  "policy.forbidden":
    "Your manifest forbids this name in the active environment (never_in). It's defined anyway — that's a foot-cannon, fix before deploying.",
  "manifest.unused":
    "Declared but no code reads it. Either remove the entry or add the reference; dead manifest entries decay over time.",
};

export async function doctorCommand(opts: DoctorOptions): Promise<void> {
  console.log(kleur.bold("envmanifest doctor"));
  console.log();

  let manifest;
  try {
    const loaded = await loadManifest(opts.cwd, opts.manifest);
    manifest = loaded.manifest;
    console.log(kleur.green("✓"), `manifest loaded: ${loaded.path}`);
  } catch (err) {
    if (err instanceof ManifestNotFoundError) {
      console.log(kleur.red("✗ no manifest.yml found"));
      console.log();
      console.log(
        "  This is the contract file every other command reads.",
      );
      console.log(
        "  Run " + kleur.cyan("envmanifest init") + " — it scans your code,",
      );
      console.log(
        "  detects every env reference, and drafts manifest.yml for you.",
      );
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const env = opts.env ?? manifest.environments?.[0] ?? "local";
  console.log(kleur.green("✓"), `active env: ${env}`);

  const [scanResult, dotenv] = await Promise.all([
    scan({ cwd: opts.cwd }),
    discoverDotenvFiles(opts.cwd, env),
  ]);

  console.log(
    kleur.green("✓"),
    `scanned ${scanResult.filesScanned} files in ${scanResult.durationMs}ms`,
  );
  if (dotenv.found.length > 0) {
    for (const f of dotenv.found) {
      console.log(kleur.green("✓"), `dotenv: ${f.path} (${f.names.size} names)`);
    }
  } else {
    console.log(
      kleur.yellow("!"),
      `no .env files found for env=${env}`,
    );
    console.log(kleur.dim(`  searched: ${dotenv.searched.length} candidates`));
  }
  console.log();

  const findings = reconcile({
    env,
    manifest,
    refs: scanResult.references,
    dotenvFiles: dotenv.found,
  });

  if (findings.length === 0) {
    console.log(kleur.green("✓ everything looks good."));
    console.log();
    console.log(
      kleur.dim(
        "  manifest, code, and .env files agree. " +
          "You're ready to commit and let CI enforce the contract.",
      ),
    );
    return;
  }

  const grouped = groupByCode(findings);
  for (const [code, group] of grouped) {
    const head =
      group[0]?.severity === "error"
        ? kleur.red("✗")
        : group[0]?.severity === "warning"
          ? kleur.yellow("!")
          : kleur.cyan("·");
    console.log(`${head} ${kleur.bold(code)} (${group.length})`);
    const explain = EXPLAIN[code];
    if (explain) console.log(kleur.dim("  " + explain));
    const seenPrefixes = new Set<string>();
    for (const f of group.slice(0, 5)) {
      let suffix = "";
      if (f.rawName && f.name && f.rawName !== f.name) {
        const prefix = f.name.slice(0, f.name.length - f.rawName.length);
        if (!seenPrefixes.has(prefix)) {
          suffix = kleur.dim(`  (prefix: ${prefix})`);
          seenPrefixes.add(prefix);
        }
      }
      console.log(kleur.dim(`    – ${f.name ?? "(unnamed)"}: ${f.message}`) + suffix);
    }
    if (group.length > 5) {
      console.log(kleur.dim(`    – ... ${group.length - 5} more`));
    }
    console.log();
  }

  if (findings.some((f) => f.severity === "error")) {
    process.exitCode = 1;
  }
}

function groupByCode(findings: Finding[]): Map<string, Finding[]> {
  const out = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = out.get(f.code);
    if (list) list.push(f);
    else out.set(f.code, [f]);
  }
  return out;
}
