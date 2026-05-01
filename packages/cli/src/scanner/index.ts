import { scanText } from "./matchers.js";
import { walkSourceFiles } from "./walk.js";
import type { ConfigReference, ScanOptions, ScanResult } from "./types.js";

export type {
  ConfigReference,
  Confidence,
  ScanOptions,
  ScanResult,
  ScanLanguage,
} from "./types.js";

export { scanText } from "./matchers.js";
export { walkSourceFiles } from "./walk.js";

export async function scan(opts: ScanOptions): Promise<ScanResult> {
  const start = Date.now();
  const refs: ConfigReference[] = [];
  let filesScanned = 0;

  for await (const file of walkSourceFiles({ cwd: opts.cwd })) {
    filesScanned++;
    const found = scanText(file.content, file.relative);
    refs.push(...found);
  }

  return {
    references: refs,
    filesScanned,
    durationMs: Date.now() - start,
  };
}

export function summarize(result: ScanResult): {
  byName: Map<string, ConfigReference[]>;
  dynamic: ConfigReference[];
  exact: ConfigReference[];
  template: ConfigReference[];
} {
  const byName = new Map<string, ConfigReference[]>();
  const dynamic: ConfigReference[] = [];
  const exact: ConfigReference[] = [];
  const template: ConfigReference[] = [];

  for (const ref of result.references) {
    if (ref.confidence === "dynamic") dynamic.push(ref);
    else if (ref.confidence === "template") template.push(ref);
    else exact.push(ref);

    if (ref.name) {
      const list = byName.get(ref.name);
      if (list) list.push(ref);
      else byName.set(ref.name, [ref]);
    }
  }

  return { byName, dynamic, exact, template };
}
