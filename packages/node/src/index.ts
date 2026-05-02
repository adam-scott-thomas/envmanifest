export const VERSION = "0.1.2";

export class EnvLoadError extends Error {
  constructor(
    public readonly missing: string[],
    public readonly project?: string,
  ) {
    const head = project ? `[${project}] ` : "";
    super(
      `${head}envmanifest: missing required env vars: ${missing.join(", ")}`,
    );
    this.name = "EnvLoadError";
  }
}

export interface DefineEnvOptions<TKeys extends string> {
  required: readonly TKeys[];
  optional?: readonly string[];
  source?: Record<string, string | undefined>;
  project?: string;
}

export type LoadedEnv<TKeys extends string> = Record<TKeys, string> &
  Record<string, string | undefined>;

export function defineEnv<TKeys extends string>(
  opts: DefineEnvOptions<TKeys>,
): LoadedEnv<TKeys> {
  const source =
    opts.source ??
    (typeof process !== "undefined" && process.env
      ? (process.env as Record<string, string | undefined>)
      : {});

  const missing: string[] = [];
  for (const name of opts.required) {
    const value = source[name];
    if (value === undefined || value === "") missing.push(name);
  }
  if (missing.length > 0) {
    throw new EnvLoadError(missing, opts.project);
  }

  return new Proxy(source, {
    get(target, key) {
      if (typeof key !== "string") return undefined;
      return target[key];
    },
  }) as LoadedEnv<TKeys>;
}
