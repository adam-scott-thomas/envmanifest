export type Confidence = "exact" | "dynamic" | "template";

export interface ConfigReference {
  name: string | null;
  raw: string;
  confidence: Confidence;
  file: string;
  line: number;
  column: number;
  matcher: string;
  note?: string;
}

export interface ScanOptions {
  cwd: string;
  patterns?: string[];
  ignore?: string[];
  languages?: ScanLanguage[];
}

export type ScanLanguage = "typescript" | "javascript";

export interface ScanResult {
  references: ConfigReference[];
  filesScanned: number;
  durationMs: number;
}
