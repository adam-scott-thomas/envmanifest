import { defineEnv, EnvLoadError } from "@envmanifest/node";

export { EnvLoadError };
export const VERSION = "0.1.0";

export interface CreateEnvOptions<TServer extends string, TPublic extends string> {
  server: readonly TServer[];
  client: readonly TPublic[];
  optional?: readonly string[];
  project?: string;
  source?: Record<string, string | undefined>;
  isServer?: boolean;
}

export type NextEnv<TServer extends string, TPublic extends string> = {
  readonly [K in TServer]: string;
} & {
  readonly [K in TPublic]: string;
};

export function createEnv<
  TServer extends string,
  TPublic extends string,
>(opts: CreateEnvOptions<TServer, TPublic>): NextEnv<TServer, TPublic> {
  const isServer = opts.isServer ?? typeof window === "undefined";

  if (!isServer) {
    for (const name of opts.server) {
      if (!isPublicSafe(name)) {
        throw new Error(
          `@envmanifest/next: '${name}' is in 'server' but accessed on the client. ` +
            `Move it to 'client' if it is meant to be exposed (its name must start with NEXT_PUBLIC_).`,
        );
      }
    }
  }

  for (const name of opts.client) {
    if (!isPublicSafe(name)) {
      throw new Error(
        `@envmanifest/next: '${name}' is listed in 'client' but its name does not start with NEXT_PUBLIC_. ` +
          `Next.js only exposes NEXT_PUBLIC_* env vars to the browser.`,
      );
    }
  }

  const allRequired = [...opts.server, ...opts.client] as const;
  const env = defineEnv({
    required: allRequired,
    ...(opts.optional !== undefined && { optional: opts.optional }),
    ...(opts.project !== undefined && { project: opts.project }),
    ...(opts.source !== undefined && { source: opts.source }),
  });
  return env as NextEnv<TServer, TPublic>;
}

function isPublicSafe(name: string): boolean {
  return name.startsWith("NEXT_PUBLIC_");
}
