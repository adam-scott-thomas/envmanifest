import { isAbsolute, join } from "node:path";
import kleur from "kleur";
import { verifyFile } from "../report/verify.js";

interface VerifyOptions {
  cwd: string;
}

export async function verifySealCommand(
  opts: VerifyOptions,
  fileArg: string,
): Promise<void> {
  if (!fileArg) {
    console.error(kleur.red("✗ usage: envmanifest verify-seal <path>"));
    process.exitCode = 1;
    return;
  }
  const abs = isAbsolute(fileArg) ? fileArg : join(opts.cwd, fileArg);
  const result = await verifyFile(abs);
  if (!result.ok) {
    console.error(kleur.red("✗"), result.reason);
    process.exitCode = 1;
    return;
  }
  console.log(kleur.green("✓"), `valid ${result.format} report (level=${result.level}, signed=${result.signed})`);
  console.log(kleur.dim(`  project:     ${result.project}`));
  console.log(kleur.dim(`  environment: ${result.environment}`));
  if (!result.signed) {
    console.log(
      kleur.dim(
        "  note: L0 is structural verification only; L1+ signed seals require the signing authority's public key.",
      ),
    );
  }
}
