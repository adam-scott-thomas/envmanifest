import { writeFile, appendFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { scan } from "../../../packages/cli/src/scanner/index.js";
import { loadManifest, ManifestNotFoundError } from "../../../packages/cli/src/manifest/load.js";
import { discoverDotenvFiles } from "../../../packages/cli/src/dotenv/parse.js";
import { reconcile, type Finding } from "../../../packages/cli/src/manifest/reconcile.js";
import { renderSarif } from "../../../packages/cli/src/format/sarif.js";

const TOOL_VERSION = "0.1.2";

function input(name: string, fallback = ""): string {
  const upper = name.toUpperCase();
  return (
    process.env[`INPUT_${upper}`] ??
    process.env[`INPUT_${upper.replace(/-/g, "_")}`] ??
    fallback
  );
}

function setOutput(name: string, value: string): void {
  const path = process.env["GITHUB_OUTPUT"];
  if (!path) {
    console.log(`::set-output name=${name}::${value}`);
    return;
  }
  void appendFile(path, `${name}=${value}\n`, "utf8");
}

function fail(message: string): void {
  console.log(`::error::${message}`);
  process.exitCode = 1;
}

function annotate(f: Finding): void {
  const sev = f.severity === "error" ? "error" : f.severity === "warning" ? "warning" : "notice";
  const title = f.code;
  const namePart = f.name ? `${f.name}: ` : "";
  console.log(`::${sev} title=${title}::${namePart}${f.message}`);
}

async function main(): Promise<void> {
  const workspace = process.env["GITHUB_WORKSPACE"] ?? process.cwd();
  const env = input("environment", "production");
  const format = (input("format", "text") || "text").toLowerCase();
  const manifestPath = input("manifest", "manifest.yml");
  const failOn = (input("fail-on", "error") || "error").toLowerCase() as
    | "error"
    | "warning"
    | "none";

  const cwd = isAbsolute(manifestPath)
    ? dirname(manifestPath)
    : dirname(resolve(workspace, manifestPath));

  let manifest;
  try {
    const loaded = await loadManifest(cwd);
    manifest = loaded.manifest;
    console.log(`manifest: ${loaded.path}`);
  } catch (err) {
    if (err instanceof ManifestNotFoundError) {
      fail(`no manifest.yml found at ${cwd}`);
      return;
    }
    throw err;
  }

  const [scanResult, dotenv] = await Promise.all([
    scan({ cwd: workspace }),
    discoverDotenvFiles(workspace, env),
  ]);

  const findings = reconcile({
    env,
    manifest,
    refs: scanResult.references,
    dotenvFiles: dotenv.found,
  });

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const infos = findings.filter((f) => f.severity === "info").length;

  setOutput("error-count", String(errors));
  setOutput("warning-count", String(warnings));
  setOutput("info-count", String(infos));

  for (const f of findings) annotate(f);

  if (format === "sarif") {
    const sarifPath = join(workspace, "envmanifest.sarif");
    await mkdir(dirname(sarifPath), { recursive: true });
    await writeFile(
      sarifPath,
      renderSarif({ findings, toolVersion: TOOL_VERSION }),
      "utf8",
    );
    setOutput("sarif", sarifPath);
    console.log(`wrote SARIF: ${sarifPath}`);
  }

  console.log(
    `findings: ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}, ${infos} info`,
  );

  const shouldFail =
    failOn === "warning"
      ? errors + warnings > 0
      : failOn === "error"
        ? errors > 0
        : false;
  if (shouldFail) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
