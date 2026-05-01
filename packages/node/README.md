# @envmanifest/node

Typed runtime loader for [envmanifest](https://github.com/adam-scott-thomas/envmanifest) contracts.

```bash
npm install @envmanifest/node
```

## Two ways to use it

### Generated module (preferred — no runtime dep)

```bash
envmanifest generate types --out src/env.ts
```

```ts
import { env } from "./env";
env.DATABASE_URL; // typed, validated at boot, fails loudly if missing
```

### Runtime package

```ts
import { defineEnv } from "@envmanifest/node";

export const env = defineEnv({
  required: ["DATABASE_URL", "STRIPE_SECRET_KEY"] as const,
  optional: ["LOG_LEVEL"],
  project: "my-api",
});
```

`defineEnv` throws `EnvLoadError` listing every missing required name when the process boots without the contract satisfied. Empty strings count as missing.

## License

MIT
