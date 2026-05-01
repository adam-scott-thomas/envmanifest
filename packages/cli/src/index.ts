import { cac } from "cac";
import { initCommand } from "./commands/init.js";
import { scanCommand } from "./commands/scan.js";
import { checkCommand } from "./commands/check.js";
import { doctorCommand } from "./commands/doctor.js";
import { exampleCommand } from "./commands/example.js";
import { generateTypesCommand } from "./commands/generate.js";

const VERSION = "0.0.0";

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
    .option("--env <name>", "environment to check")
    .action(doctorCommand);

  cli
    .command("example", "regenerate .env.example from manifest")
    .option("--cwd <dir>", "working directory", { default: process.cwd() })
    .option("--env <name>", "environment to render", { default: "local" })
    .option("--out <path>", "output path", { default: ".env.example" })
    .option("--force", "overwrite existing file")
    .action(exampleCommand);

  cli
    .command("generate-types", "emit a typed env loader from manifest")
    .alias("gen-types")
    .option("--cwd <dir>", "working directory", { default: process.cwd() })
    .option("--env <name>", "environment to render", { default: "production" })
    .option("--out <path>", "output path", { default: "src/env.ts" })
    .option("--force", "overwrite existing file")
    .action(generateTypesCommand);

  cli.help();
  cli.version(VERSION);
  cli.parse(argv, { run: false });

  await cli.runMatchedCommand();
}
