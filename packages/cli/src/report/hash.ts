import { createHash } from "node:crypto";

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function manifestHash(yamlSource: string): string {
  return `sha256:${sha256Hex(canonicalizeYaml(yamlSource))}`;
}

export function keySetHash(names: string[]): string {
  const sorted = Array.from(new Set(names)).sort();
  return `sha256:${sha256Hex(sorted.join("\n"))}`;
}

function canonicalizeYaml(source: string): string {
  return source.replace(/\r\n/g, "\n").trimEnd() + "\n";
}
