import { writeFile, access, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import kleur from "kleur";
import { loadManifest, ManifestNotFoundError } from "../manifest/load.js";
import { generateTypesModule } from "../generate/types.js";

interface GenerateOptions {
  cwd: string;
  env: string;
  out: string;
  force?: boolean;
}

export async function generateTypesCommand(opts: GenerateOptions): Promise<void> {
  let manifest;
  try {
    const loaded = await loadManifest(opts.cwd);
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

  const out = resolve(join(opts.cwd, opts.out));
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

  await mkdir(dirname(out), { recursive: true });
  const code = generateTypesModule({ env: opts.env, manifest });
  await writeFile(out, code, "utf8");
  console.log(kleur.green("✓"), `wrote ${out}`);
  console.log(kleur.dim(`  import { env } from "./${relativeImportPath(opts.out)}"`));
}

function relativeImportPath(out: string): string {
  return out.replace(/\.tsx?$/, "").replace(/^\.?\/?/, "");
}
