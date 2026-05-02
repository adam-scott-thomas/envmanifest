import { writeFile, access, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import kleur from "kleur";
import { scan } from "../scanner/index.js";
import { draftManifestYaml } from "../manifest/draft.js";
import { loadWranglerConfig } from "../wrangler/parse.js";

interface InitOptions {
  cwd: string;
  force?: boolean;
  out?: string;
}

const COMPONENT_MARKERS = [
  "package.json",
  "pyproject.toml",
  "setup.py",
  "Cargo.toml",
  "go.mod",
  "wrangler.toml",
  "wrangler.jsonc",
  "wrangler.json",
];

const IGNORED_SUBDIRS = new Set([
  "node_modules",
  ".git",
  ".venv",
  "venv",
  "dist",
  "build",
  ".next",
  ".open-next",
  "target",
  "__pycache__",
  ".turbo",
  ".vercel",
  ".cache",
  "coverage",
]);

async function detectComponents(cwd: string): Promise<string[]> {
  const found: string[] = [];
  let entries;
  try {
    entries = await readdir(cwd, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return [];
  }
  for (const entry of entries) {
    const name = String(entry.name);
    if (!entry.isDirectory()) continue;
    if (IGNORED_SUBDIRS.has(name)) continue;
    if (name.startsWith(".") && IGNORED_SUBDIRS.has(name)) continue;
    const subdir = join(cwd, name);
    let subEntries;
    try {
      subEntries = await readdir(subdir, { encoding: "utf8" });
    } catch {
      continue;
    }
    if (subEntries.some((f) => COMPONENT_MARKERS.includes(String(f)))) {
      found.push(name);
    }
  }
  return found.sort();
}

function isNonInteractive(): boolean {
  if (process.env["CI"]) return true;
  if (process.env["ENVMANIFEST_NON_INTERACTIVE"]) return true;
  // stdin not a TTY → non-interactive (CI runners, piped input)
  if (typeof process.stdin?.isTTY === "undefined") return true;
  return !process.stdin.isTTY;
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

  // Multi-component detection — refuse to mash in CI.
  const components = await detectComponents(opts.cwd);
  if (components.length >= 2 && isNonInteractive()) {
    console.error(kleur.red("✗ multi-component repository detected"));
    console.error(
      `  ${components.length} component projects found below this directory:`,
    );
    for (const c of components.slice(0, 8)) {
      console.error(kleur.dim(`    ${c}/`));
    }
    if (components.length > 8) {
      console.error(kleur.dim(`    ... ${components.length - 8} more`));
    }
    console.error("");
    console.error("  Cannot mash a multi-component repo into a single manifest.yml safely");
    console.error("  in non-interactive mode. Choose:");
    console.error("");
    console.error("    1. Run 'envmanifest init' inside each component directory, or");
    console.error("    2. Run 'envmanifest init --workspace' to generate workspace.yml");
    console.error("       (workspace.yml support ships in v0.2)");
    console.error("");
    console.error(
      kleur.dim("  See https://env.ghostlogic.tech/docs/workspaces for details."),
    );
    process.exitCode = 2;
    return;
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
  if (components.length >= 2) {
    console.log(
      kleur.yellow(
        `  ! ${components.length} component projects detected — drafting a single root manifest. Consider per-component manifests for cleaner reconciliation.`,
      ),
    );
  }

  const project = basename(resolve(opts.cwd));
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
