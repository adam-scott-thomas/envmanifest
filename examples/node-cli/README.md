# node-cli example

Minimal end-to-end demo of envmanifest in a tiny Node app.

## Try it

```bash
cd examples/node-cli
cp .env.example .env.local
# edit .env.local — at minimum set API_TOKEN=tok_something

npm install
npm run envm:doctor      # plain-English diagnosis
npm run envm:check       # CI-shaped reconcile
npm run envm:generate    # emit src/env.generated.ts (typed)
npm start                # boot — fails loudly if API_TOKEN is missing
```

## What's here

- `manifest.yml` — the contract: 1 secret, 2 env vars (one optional, one enum)
- `.env.example` — generated, committed
- `.env.local` — your local values, **never committed**
- `src/main.ts` — uses `defineEnv` from `@envmanifest/node`. Throws on boot if required vars are missing.
- `src/env.generated.ts` — created by `envm:generate`, typed equivalent of `defineEnv`. Pick whichever style suits the project.

## What this demonstrates

- The full reconciliation loop: code ↔ manifest ↔ `.env*`
- Heuristic-driven `init` would correctly classify these names (`API_TOKEN` → secret, `LOG_LEVEL` → enum, `GREETING_NAME` → optional env)
- The runtime loader fails fast with a clear message naming every missing variable

## Note on `defineEnv` and the scanner

When you list resource names inside `defineEnv({ required: [...] })`, the scanner sees them as **data**, not direct `process.env.X` accesses, so `envmanifest check` reports them as `manifest.unused` (info-level, not error). That's working as intended — the runtime loader still validates them. If you want code-side detection too, use the **generated** style instead:

```bash
envmanifest generate-types --out src/env.ts
```

```ts
// generated module accesses process.env directly under the hood,
// which the scanner sees as exact references.
import { env } from "./env";
console.log(env.API_TOKEN);
```
