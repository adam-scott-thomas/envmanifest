import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const DEFAULT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".open-next",
  ".turbo",
  ".vercel",
  ".wrangler",
  "coverage",
  ".vitest-cache",
  ".cache",
  "out",
  ".svelte-kit",
  ".astro",
  ".nuxt",
  ".output",
]);

export interface WalkOptions {
  cwd: string;
  extensions?: Set<string>;
  ignoreDirs?: Set<string>;
}

export async function* walkSourceFiles(
  opts: WalkOptions,
): AsyncIterable<{ absolute: string; relative: string; content: string }> {
  const exts = opts.extensions ?? DEFAULT_EXTENSIONS;
  const ignored = opts.ignoreDirs ?? DEFAULT_IGNORE_DIRS;
  yield* walk(opts.cwd, opts.cwd, exts, ignored);
}

async function* walk(
  root: string,
  dir: string,
  exts: Set<string>,
  ignored: Set<string>,
): AsyncIterable<{ absolute: string; relative: string; content: string }> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return;
  }

  for (const entry of entries) {
    const name = String(entry.name);
    if (entry.isDirectory()) {
      if (ignored.has(name)) continue;
      yield* walk(root, join(dir, name), exts, ignored);
      continue;
    }
    if (!entry.isFile()) continue;
    const dotIdx = name.lastIndexOf(".");
    if (dotIdx < 0) continue;
    const ext = name.slice(dotIdx);
    if (!exts.has(ext)) continue;

    const absolute = join(dir, name);
    let info: Awaited<ReturnType<typeof stat>>;
    try {
      info = await stat(absolute);
    } catch {
      continue;
    }
    if (info.size > 5_000_000) continue;

    let content: string;
    try {
      content = await readFile(absolute, "utf8");
    } catch {
      continue;
    }
    yield {
      absolute,
      relative: relative(root, absolute).split(sep).join("/"),
      content,
    };
  }
}
