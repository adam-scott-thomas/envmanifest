import type {
  Exposure,
  ResourceKind,
} from "@envmanifest/schema";

const SECRET_HINTS = [
  "SECRET",
  "KEY",
  "TOKEN",
  "PASSWORD",
  "PASS",
  "PRIVATE",
  "CREDENTIALS",
  "DSN",
  "AUTH",
  "WEBHOOK_SECRET",
];

const PUBLIC_PREFIXES = [
  "NEXT_PUBLIC_",
  "VITE_",
  "PUBLIC_",
  "EXPO_PUBLIC_",
  "REACT_APP_",
  "GATSBY_",
  "STORYBOOK_",
];

const PLATFORM_INJECTED = new Set([
  "VERCEL",
  "VERCEL_URL",
  "VERCEL_ENV",
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_REGION",
  "CF_PAGES",
  "CF_PAGES_BRANCH",
  "CF_PAGES_COMMIT_SHA",
  "CF_PAGES_URL",
  "AWS_REGION",
  "AWS_LAMBDA_FUNCTION_NAME",
  "AWS_EXECUTION_ENV",
  "RAILWAY_PROJECT_ID",
  "RENDER",
  "RENDER_SERVICE_ID",
  "FLY_APP_NAME",
  "FLY_REGION",
  "NODE_ENV",
  "PORT",
  "HOSTNAME",
  "PWD",
  "HOME",
  "USER",
  "PATH",
  "GITHUB_ACTIONS",
  "GITHUB_WORKSPACE",
  "GITHUB_OUTPUT",
  "GITHUB_ENV",
  "GITHUB_REPOSITORY",
  "GITHUB_SHA",
  "GITHUB_REF",
  "GITHUB_RUN_ID",
  "GITHUB_TOKEN",
  "CI",
  "RUNNER_OS",
  "RUNNER_TEMP",
  "RUNNER_ARCH",
]);

const URL_PATTERNS = [/_URL$/, /_URI$/, /_ENDPOINT$/, /_HOST$/];
const BOOL_PATTERNS = [/^(ENABLE|DISABLE|USE|IS|HAS)_/, /_ENABLED$/, /_DISABLED$/];
const ENUM_HINTS = ["LOG_LEVEL", "MODE", "ENV"];

export interface InferredResource {
  name: string;
  kind: ResourceKind;
  exposure: Exposure;
  type?: string;
  platform_generated?: boolean;
  required?: boolean;
}

export function inferResource(name: string): InferredResource {
  const upper = name.toUpperCase();

  const isPlatform = PLATFORM_INJECTED.has(upper);
  const isPublic = PUBLIC_PREFIXES.some((p) => upper.startsWith(p));
  const looksSecret =
    !isPublic && SECRET_HINTS.some((h) => upper.includes(h));

  const kind: ResourceKind = looksSecret ? "secret" : "env";
  const exposure: Exposure = isPublic ? "public" : "server";

  let type: string | undefined;
  if (URL_PATTERNS.some((re) => re.test(upper))) type = "url";
  else if (BOOL_PATTERNS.some((re) => re.test(upper))) type = "bool";
  else if (ENUM_HINTS.includes(upper)) type = "enum";

  const result: InferredResource = { name, kind, exposure };
  if (type !== undefined) result.type = type;
  if (isPlatform) {
    result.platform_generated = true;
    result.required = false;
  }
  return result;
}
