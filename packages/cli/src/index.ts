import { cac } from "cac";
import { initCommand } from "./commands/init.js";
import { scanCommand } from "./commands/scan.js";
import { checkCommand } from "./commands/check.js";
import { doctorCommand } from "./commands/doctor.js";
import { exampleCommand } from "./commands/example.js";

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
    .action(checkCommand);

  cli
    .command("doctor", "plain-English diagnosis")
    .option("--cwd <dir>", "working directory", { default: process.cwd() })
    .action(doctorCommand);

  cli
    .command("example", "regenerate .env.example from manifest")
    .option("--cwd <dir>", "working directory", { default: process.cwd() })
    .option("--env <name>", "environment to render", { default: "local" })
    .option("--out <path>", "output path", { default: ".env.example" })
    .action(exampleCommand);

  cli.help();
  cli.version(VERSION);
  cli.parse(argv, { run: false });

  await cli.runMatchedCommand();
}
