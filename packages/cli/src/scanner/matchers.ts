import type { ConfigReference, Confidence } from "./types.js";

interface MatcherDef {
  name: string;
  pattern: RegExp;
  resolve: (m: RegExpMatchArray) => {
    name: string | null;
    confidence: Confidence;
    note?: string;
  };
}

const VALID_NAME = /^[A-Z_][A-Z0-9_]*$/;

export const MATCHERS: MatcherDef[] = [
  {
    name: "node:dot-access",
    pattern: /\bprocess\.env\.([A-Za-z_][A-Za-z0-9_]*)\b/g,
    resolve: (m) => {
      const name = m[1] ?? null;
      const confidence: Confidence =
        name && VALID_NAME.test(name) ? "exact" : "exact";
      return { name, confidence };
    },
  },
  {
    name: "node:bracket-string",
    pattern: /\bprocess\.env\[\s*["']([^"']+)["']\s*\]/g,
    resolve: (m) => ({ name: m[1] ?? null, confidence: "exact" }),
  },
  {
    name: "node:bracket-template",
    pattern: /\bprocess\.env\[\s*`([^`]*)`\s*\]/g,
    resolve: (m) => {
      const literal = m[1] ?? "";
      const hasInterp = literal.includes("${");
      if (!hasInterp && VALID_NAME.test(literal)) {
        return { name: literal, confidence: "exact" };
      }
      return {
        name: null,
        confidence: "template",
        note: `template literal: \`${literal}\``,
      };
    },
  },
  {
    name: "node:bracket-dynamic",
    pattern: /\bprocess\.env\[\s*([^"'`\]\s][^\]]*)\]/g,
    resolve: (m) => ({
      name: null,
      confidence: "dynamic",
      note: `dynamic env access: process.env[${(m[1] ?? "").trim()}]`,
    }),
  },
  {
    name: "vite:dot-access",
    pattern: /\bimport\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)\b/g,
    resolve: (m) => ({ name: m[1] ?? null, confidence: "exact" }),
  },
  {
    name: "vite:bracket-string",
    pattern: /\bimport\.meta\.env\[\s*["']([^"']+)["']\s*\]/g,
    resolve: (m) => ({ name: m[1] ?? null, confidence: "exact" }),
  },
  {
    name: "deno:env-get",
    pattern: /\bDeno\.env\.get\(\s*["']([^"']+)["']\s*\)/g,
    resolve: (m) => ({ name: m[1] ?? null, confidence: "exact" }),
  },
  {
    name: "bun:dot-access",
    pattern: /\bBun\.env\.([A-Za-z_][A-Za-z0-9_]*)\b/g,
    resolve: (m) => ({ name: m[1] ?? null, confidence: "exact" }),
  },
];

const IGNORE_LINE_PATTERN = /\/\/\s*envmanifest-ignore-next-line\b/;

export function scanText(
  text: string,
  filePath: string,
): ConfigReference[] {
  const refs: ConfigReference[] = [];
  const lines = text.split(/\r?\n/);
  const ignoredLines = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (IGNORE_LINE_PATTERN.test(line)) {
      ignoredLines.add(i + 2);
    }
  }

  for (const matcher of MATCHERS) {
    matcher.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = matcher.pattern.exec(text)) !== null) {
      const offset = m.index;
      const before = text.slice(0, offset);
      const lineNum = (before.match(/\n/g)?.length ?? 0) + 1;
      const lineStart = before.lastIndexOf("\n") + 1;
      const column = offset - lineStart + 1;

      if (ignoredLines.has(lineNum)) {
        continue;
      }

      const resolved = matcher.resolve(m);
      refs.push({
        name: resolved.name,
        raw: m[0],
        confidence: resolved.confidence,
        file: filePath,
        line: lineNum,
        column,
        matcher: matcher.name,
        ...(resolved.note !== undefined && { note: resolved.note }),
      });
    }
  }

  refs.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.column - b.column;
  });

  return refs;
}
