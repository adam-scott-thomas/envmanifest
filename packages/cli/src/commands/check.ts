import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import kleur from "kleur";
import { scan } from "../scanner/index.js";
import { loadManifest, ManifestNotFoundError } from "../manifest/load.js";
import { discoverDotenvFiles } from "../dotenv/parse.js";
import { reconcile } from "../manifest/reconcile.js";
import { renderSarif } from "../format/sarif.js";
import { buildL0Report } from "../report/l0.js";
import { buildInTotoStatement } from "../report/intoto.js";

const TOOL_VERSION = "0.0.0";

interface CheckOptions {
  cwd: string;
  env: string;
  format?: "text" | "sarif";
  output?: string;
  failOn?: "error" | "warning" | "none";
  report?: "l0" | "intoto";
  reportOut?: string;
}

export async function checkCommand(opts: CheckOptions): Promise<void> {
  const format = opts.format ?? "text";
  const failOn = opts.failOn ?? "error";

  let manifest;
  let manifestSource = "";
  try {
    const loaded = await loadManifest(opts.cwd);
    manifest = loaded.manifest;
    manifestSource = loaded.source;
    if (format === "text") console.log(kleur.dim(`manifest: ${loaded.path}`));
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

  const findings = reconcile({
    env: opts.env,
    manifest,
    refs: scanResult.references,
    dotenvFiles: dotenv.found,
  });

  if (opts.report) {
    const presentNames = collectPresentNames(scanResult.references, dotenv.found);
    const l0 = buildL0Report({
      manifest,
      manifestSource,
      env: opts.env,
      findings,
      presentNames,
      cliVersion: TOOL_VERSION,
    });
    const reportObj = opts.report === "intoto" ? buildInTotoStatement({ l0 }) : l0;
    const reportText = JSON.stringify(reportObj, null, 2);
    if (opts.reportOut) {
      const outPath = join(opts.cwd, opts.reportOut);
      await writeFile(outPath, reportText, "utf8");
      if (format === "text") console.log(kleur.green("✓"), `wrote ${opts.report} report: ${outPath}`);
    } else if (format !== "sarif") {
      process.stdout.write(reportText + "\n");
      return;
    }
  }

  if (format === "sarif") {
    const sarifText = renderSarif({ findings, toolVersion: TOOL_VERSION });
    if (opts.output) {
      const outPath = join(opts.cwd, opts.output);
      await writeFile(outPath, sarifText, "utf8");
      console.error(`wrote ${outPath}`);
    } else {
      process.stdout.write(sarifText + "\n");
    }
    if (shouldFail(findings, failOn)) process.exitCode = 1;
    return;
  }

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

  if (shouldFail(findings, failOn)) {
    process.exitCode = 1;
  }
}

function collectPresentNames(
  refs: import("../scanner/types.js").ConfigReference[],
  dotenvFiles: import("../dotenv/parse.js").DotenvFile[],
): string[] {
  const set = new Set<string>();
  for (const r of refs) if (r.name) set.add(r.name);
  for (const f of dotenvFiles) for (const n of f.names) set.add(n);
  return Array.from(set).sort();
}

function shouldFail(
  findings: import("../manifest/reconcile.js").Finding[],
  failOn: "error" | "warning" | "none",
): boolean {
  if (failOn === "none") return false;
  if (failOn === "error") return findings.some((f) => f.severity === "error");
  return findings.some(
    (f) => f.severity === "error" || f.severity === "warning",
  );
}
