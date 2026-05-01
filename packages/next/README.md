# @envmanifest/next

Next.js framework integration for [envmanifest](https://github.com/adam-scott-thomas/envmanifest).

```bash
npm install @envmanifest/next
```

```ts
// src/env.ts
import { createEnv } from "@envmanifest/next";

export const env = createEnv({
  server: ["DATABASE_URL", "STRIPE_SECRET_KEY"] as const,
  client: ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const,
  optional: ["LOG_LEVEL"],
  project: "my-app",
});
```

## Why this exists

Next.js bundles everything in `client` into the browser. If a non-public name slips into the client list, secrets leak. `createEnv`:

- Throws at module load if a `client` name does not start with `NEXT_PUBLIC_`.
- Throws if a `server` name (that is *not* `NEXT_PUBLIC_*`) is accessed on the client.
- Validates all required names are present (empty string counts as missing).

Combine with `envmanifest generate-types` to keep the lists in sync with `manifest.yml`.

## License

MIT
