import { writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import kleur from "kleur";
import { loadManifest, ManifestNotFoundError } from "../manifest/load.js";
import { renderEnvExample } from "../dotenv/example.js";

interface ExampleOptions {
  cwd: string;
  env: string;
  out: string;
  force?: boolean;
  manifest?: string;
}

export async function exampleCommand(opts: ExampleOptions): Promise<void> {
  let manifest;
  try {
    const loaded = await loadManifest(opts.cwd, opts.manifest);
    manifest = loaded.manifest;
  } catch (err) {
    if (err instanceof ManifestNotFoundError) {
      console.error(kleur.red("✗ no manifest.yml found"));
      console.error(kleur.dim("  run 'envmanifest init' to create one"));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const out = join(opts.cwd, opts.out);
  if (!opts.force) {
    try {
      await access(out);
      console.error(
        kleur.red(`✗ ${out} already exists.`),
        kleur.dim("Pass --force to overwrite."),
      );
      process.exitCode = 1;
      return;
    } catch {
      // file doesn't exist
    }
  }

  const text = renderEnvExample({ env: opts.env, manifest });
  await writeFile(out, text, "utf8");
  console.log(kleur.green("✓"), `wrote ${out}`);
}
