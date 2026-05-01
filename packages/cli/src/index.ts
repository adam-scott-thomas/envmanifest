import { cac } from "cac";
import { initCommand } from "./commands/init.js";
import { scanCommand } from "./commands/scan.js";
import { checkCommand } from "./commands/check.js";
import { doctorCommand } from "./commands/doctor.js";
import { exampleCommand } from "./commands/example.js";
import { generateTypesCommand } from "./commands/generate.js";
import { verifySealCommand } from "./commands/verify.js";
import { redactCommand } from "./commands/redact.js";
import { explainCommand } from "./commands/explain.js";

const VERSION = "0.1.0";

export async function run(argv: string[]): Promise<void> {
  const cli = cac("envmanifest");

  cli
    .command("init", "scan code, draft manifest.yml")
    .option("--cwd <dir>", "working directory", { default: process.cwd() })
    .option("--force", "overwrite existing manifest.yml")
    .option("--out <path>", "output filename", { default: "manifest.yml" })
    .action(initCommand);

  cli
    .command("scan", "list every config reference, with confidence")
    .option("--cwd <dir>", "working directory", { default: process.cwd() })
    .option("--explain", "show why each reference was matched")
    .action(scanCommand);

  cli
    .command("check", "reconcile manifest ↔ .env* ↔ code")
    .option("--cwd <dir>", "working directory", { default: process.cwd() })
    .option("--manifest <path>", "path to manifest file (default: manifest.yml in cwd)")
    .option("--env <name>", "environment to check", { default: "local" })
    .option("--format <fmt>", "output format: text or sarif", { default: "text" })
    .option("--output <path>", "write output to file (sarif format)")
    .option("--fail-on <level>", "fail level: error, warning, none", { default: "error" })
    .option("--report <kind>", "emit unsigned report: l0 or intoto")
    .option("--report-out <path>", "write report to file (defaults to stdout)")
    .action(checkCommand);

  cli
    .command("doctor", "plain-English diagnosis")
    .option("--cwd <dir>", "working directory", { default: process.cwd() })
    .option("--manifest <path>", "path to manifest file (default: manifest.yml in cwd)")
    .option("--env <name>", "environment to check")
    .action(doctorCommand);

  cli
    .command("example", "regenerate .env.example from manifest")
    .option("--cwd <dir>", "working directory", { default: process.cwd() })
    .option("--manifest <path>", "path to manifest file (default: manifest.yml in cwd)")
    .option("--env <name>", "environment to render", { default: "local" })
    .option("--out <path>", "output path", { default: ".env.example" })
    .option("--force", "overwrite existing file")
    .action(exampleCommand);

  cli
    .command("generate-types", "emit a typed env loader from manifest")
    .alias("gen-types")
    .option("--cwd <dir>", "working directory", { default: process.cwd() })
    .option("--manifest <path>", "path to manifest file (default: manifest.yml in cwd)")
    .option("--env <name>", "environment to render", { default: "production" })
    .option("--out <path>", "output path", { default: "src/env.ts" })
    .option("--force", "overwrite existing file")
    .action(generateTypesCommand);

  cli
    .command("verify-seal <file>", "verify an L0 unsigned report or in-toto Statement offline")
    .option("--cwd <dir>", "working directory", { default: process.cwd() })
    .action((file: string, opts: { cwd: string }) => verifySealCommand(opts, file));

  cli
    .command("redact <file>", "redact secrets in a file using the manifest's secret list")
    .option("--cwd <dir>", "working directory", { default: process.cwd() })
    .option("--manifest <path>", "path to manifest file (default: manifest.yml in cwd)")
    .option("--out <path>", "write redacted output to file (defaults to stdout)")
    .option("--in-place", "rewrite the file in place")
    .action((file: string, opts: { cwd: string; manifest?: string; out?: string; inPlace?: boolean }) =>
      redactCommand(opts, file),
    );

  cli
    .command("explain <name>", "show full metadata for a manifest resource")
    .option("--cwd <dir>", "working directory", { default: process.cwd() })
    .option("--manifest <path>", "path to manifest file (default: manifest.yml in cwd)")
    .action((name: string, opts: { cwd: string; manifest?: string }) =>
      explainCommand(opts, name),
    );

  cli.help();
  cli.version(VERSION);
  cli.parse(argv, { run: false });

  await cli.runMatchedCommand();
}
