import { writeFile, access } from "node:fs/promises";
import { basename, join } from "node:path";
import kleur from "kleur";
import { scan } from "../scanner/index.js";
import { draftManifestYaml } from "../manifest/draft.js";
import { loadWranglerConfig } from "../wrangler/parse.js";

interface InitOptions {
  cwd: string;
  force?: boolean;
  out?: string;
}

export async function initCommand(opts: InitOptions): Promise<void> {
  const out = join(opts.cwd, opts.out ?? "manifest.yml");

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
      // file doesn't exist; proceed
    }
  }

  console.log(kleur.dim(`Scanning ${opts.cwd}...`));
  const [result, wrangler] = await Promise.all([
    scan({ cwd: opts.cwd }),
    loadWranglerConfig(opts.cwd),
  ]);
  const distinct = new Set(result.references.map((r) => r.name).filter(Boolean));
  console.log(
    kleur.dim(
      `  ${result.filesScanned} files, ${distinct.size} distinct names, ${result.durationMs}ms`,
    ),
  );
  if (wrangler) {
    console.log(
      kleur.dim(
        `  wrangler: ${wrangler.path} (${wrangler.bindings.length} bindings)`,
      ),
    );
  }

  const project = basename(opts.cwd);
  const yaml = draftManifestYaml(result.references, {
    project,
    ...(wrangler ? { bindings: wrangler.bindings } : {}),
  });
  await writeFile(out, yaml, "utf8");

  console.log(kleur.green("✓"), `wrote ${out}`);
  console.log();
  console.log(kleur.dim("Next:"));
  console.log(kleur.dim("  • review the draft and adjust kinds/exposures"));
  console.log(kleur.dim("  • envmanifest check    # reconcile with .env files"));
  console.log(kleur.dim("  • envmanifest example  # regenerate .env.example"));
}
