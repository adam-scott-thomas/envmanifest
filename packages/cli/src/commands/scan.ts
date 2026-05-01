import kleur from "kleur";
import { scan, summarize } from "../scanner/index.js";

interface ScanOptions {
  cwd: string;
  explain?: boolean;
}

export async function scanCommand(opts: ScanOptions): Promise<void> {
  const result = await scan({ cwd: opts.cwd });
  const { byName, dynamic, template } = summarize(result);

  const distinctExactNames = Array.from(byName.keys()).sort();

  if (distinctExactNames.length === 0 && dynamic.length === 0 && template.length === 0) {
    console.log(
      kleur.dim(
        `No config references found in ${result.filesScanned} files (${result.durationMs}ms).`,
      ),
    );
    return;
  }

  console.log(
    kleur.bold(
      `Scanned ${result.filesScanned} files in ${result.durationMs}ms — ` +
        `${distinctExactNames.length} distinct names, ${dynamic.length} dynamic, ${template.length} template.`,
    ),
  );
  console.log();

  for (const name of distinctExactNames) {
    const refs = byName.get(name) ?? [];
    console.log(kleur.green("✓"), kleur.bold(name), kleur.dim(`(${refs.length})`));
    if (opts.explain) {
      for (const ref of refs) {
        console.log(
          kleur.dim(`    ${ref.file}:${ref.line}:${ref.column}  ${ref.matcher}  ${ref.raw}`),
        );
      }
    }
  }

  if (template.length > 0) {
    console.log();
    console.log(kleur.yellow("Template references (could not resolve statically):"));
    for (const ref of template) {
      console.log(
        kleur.yellow("?"),
        `${ref.file}:${ref.line}`,
        kleur.dim(`— ${ref.note ?? ref.raw}`),
      );
    }
  }

  if (dynamic.length > 0) {
    console.log();
    console.log(kleur.yellow("Dynamic env access (cannot statically resolve):"));
    for (const ref of dynamic) {
      console.log(
        kleur.yellow("?"),
        `${ref.file}:${ref.line}`,
        kleur.dim(`— ${ref.note ?? ref.raw}`),
      );
      console.log(
        kleur.dim(
          "    → add a manifest entry or `// envmanifest-ignore-next-line dynamic-env-name`",
        ),
      );
    }
  }
}
