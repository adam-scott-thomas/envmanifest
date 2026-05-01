export type RedactionLevel = "off" | "partial" | "full";

const SENSITIVE_NAME_PATTERNS = [
  /SECRET/i,
  /KEY/i,
  /TOKEN/i,
  /PASSWORD/i,
  /PRIVATE/i,
  /CREDENTIAL/i,
  /AUTH/i,
];

export function isSensitiveName(name: string): boolean {
  return SENSITIVE_NAME_PATTERNS.some((re) => re.test(name));
}

export function redactName(name: string, level: RedactionLevel): string {
  if (level === "off") return name;
  if (level === "full") return "<redacted>";
  if (!isSensitiveName(name)) return name;
  if (name.length <= 6) return "***";
  const prefix = name.slice(0, 3);
  return `${prefix}...`;
}
