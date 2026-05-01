# envmanifest

**The config contract layer for AI-assisted software delivery.**

Declare your app's config once. Reconcile it across code, local files, CI, and deployed providers. Generate signed attestations of what was actually deployed. Free CLI for local checks. Paid cloud adapters and signed seals for deployed config.

> **Status:** schema v0 (experimental). MVP CLI ships before any paid features.

```bash
# inside a project
npx envmanifest init        # scan code, draft manifest.yml
npx envmanifest doctor      # plain-English diagnosis
npx envmanifest check       # reconcile manifest ↔ code ↔ .env
```

---

## Why

Every coding agent burns 20+ turns guessing env-var names because no machine-readable contract exists across code, dotfiles, CI, and provider state. Per-vendor tools don't reconcile. Supply-chain attestation has been left out for config.

`envmanifest` fills the gap with one file at the repo root that names every env var, secret, and platform binding the app needs — scoped by environment, phase, exposure, and service.

## What's in the contract

```yaml
# manifest.yml
version: 0
project: my-app
environments: [local, dev, staging, production]

resources:
  - name: DATABASE_URL
    kind: secret           # env / secret / binding
    type: url
    exposure: server       # server / public / ci / client
    phase: [runtime]       # build / runtime
    environments: [local, dev, staging, production]
    sources:
      - provider: aws-secrets-manager
        ref: aws-sm://${ENV}/db/url
        environments: [staging, production]
      - provider: dotenv
        environments: [local, dev]

  - name: ASSETS_BUCKET
    kind: binding          # platform resources are first-class
    binding:
      provider: cloudflare-r2
      resource_type: bucket
      resource_id: my-app-assets-${ENV}
      permissions: [read, write]
```

See [`examples/manifest.example.v0.yml`](examples/manifest.example.v0.yml) for every v0 feature.

## CLI

| Command | Purpose |
|---|---|
| `envmanifest init` | Scan code, draft `manifest.yml` |
| `envmanifest scan [--explain]` | List every config reference with confidence (exact / template / dynamic) |
| `envmanifest check` | Reconcile manifest ↔ `.env*` ↔ code |
| `envmanifest doctor` | Plain-English diagnosis |
| `envmanifest example` | Regenerate `.env.example` from manifest |
| `envmanifest generate-types` | Emit a typed env loader for your stack |
| `envmanifest explain <NAME>` | Full metadata for one resource |
| `envmanifest redact <file>` | Mask secrets in a file using the manifest's secret list — safe paste-into-bug-reports |
| `envmanifest verify-seal <file>` | Verify an L0 / in-toto report offline |

```
$ envmanifest doctor
✓ manifest loaded
✓ active env: local
✓ scanned 95 files in 56ms
✓ dotenv: .env.local (8 names)

✓ everything looks good.
```

## Runtime

Pick the style that fits your project.

**Generated module** (no runtime dep):
```bash
envmanifest generate-types --out src/env.ts
```
```ts
import { env } from "./env"
env.DATABASE_URL  // typed, validated at boot, fails loudly if missing
```

**Runtime package**:
```ts
import { defineEnv } from "@envmanifest/node"
export const env = defineEnv({
  required: ["DATABASE_URL", "STRIPE_SECRET_KEY"] as const,
  project: "my-api",
})
```

**Next.js**:
```ts
import { createEnv } from "@envmanifest/next"
export const env = createEnv({
  server: ["DATABASE_URL"] as const,
  client: ["NEXT_PUBLIC_APP_URL"] as const,
})
```

## CI / GitHub Action

```yaml
- uses: adam-scott-thomas/envmanifest/actions/check@main
  with:
    environment: production
    format: sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: envmanifest.sarif
```

Inline annotations on PR diffs, SARIF for code scanning, configurable fail level.

## Coding agents (MCP)

Local MCP server exposes the contract to AI assistants — names + metadata only, **never values**. Default-deny on mutating tools. Sensitive names are redacted partial by default.

Configure your MCP client to spawn `envmanifest-mcp` from your project root.

| Tool | Returns |
|---|---|
| `list_required(env, service?)` | Required resources for the env |
| `validate(env, presentNames)` | Missing / forbidden / unknown |
| `explain_requirement(name)` | Full metadata for one resource |
| `resolve_source(name, env)` | Provider list (no values) |
| `list_missing(env, presentNames)` | Convenience wrapper |

## Reports

Every `check` can emit two unsigned report formats today; signed L1+ seals are part of the paid roadmap.

```bash
envmanifest check --report l0       # local report
envmanifest check --report intoto   # in-toto Statement v1, supply-chain ready
```

## Packages

| Package | Path | License |
|---|---|---|
| `envmanifest` (CLI) | `packages/cli` | MIT |
| `@envmanifest/schema` | `packages/schema` | MIT |
| `@envmanifest/node` | `packages/node` | MIT |
| `@envmanifest/next` | `packages/next` | MIT |
| `@envmanifest/mcp-local` | `packages/mcp-local` | MIT |
| GitHub Action | `actions/check` | MIT |

Cloud adapters (Phase 2) will be source-available under BSL 1.1, auto-converting to Apache 2.0 after 2 years.

## What this is not

- **Not a secret store.** Use Vault / Doppler / Infisical / AWS SM / GCP SM / 1Password. envmanifest references them.
- **Not a `.env` editor.** Your IDE is the editor.
- **Not encryption-at-rest.** That's storage's job.
- **Not a chat interface.** The MCP server is the agent surface.

## Status & roadmap

- ✅ Schema v0 (experimental), CLI, runtime loaders, MCP local, GitHub Action, L0 + in-toto unsigned reports
- ✅ Schema host live at https://env.ghostlogic.tech
- 🛠 Cloud adapters (Cloudflare Workers, Vercel) — Phase 2
- 🛠 Signed L2/L3 seals via Blackbox — Phase 2
- 🛠 Fleet dashboard, audit log, SSO — Team tier

See [`docs/spec-v0.md`](docs/spec-v0.md) for the full spec.

## Known v0 limits

- TypeScript / JavaScript scanner only. Python in v0.2.
- Cloudflare binding auto-discovery covers `wrangler.toml` / `wrangler.jsonc` for: r2_buckets, d1_databases, kv_namespaces, queues.producers, durable_objects, ai, vectorize, hyperdrive, analytics_engine_datasets, services, assets. Other providers' platform configs (Vercel, AWS) are still manual.
- Schema v0 → v1 transition will lock after real-world contact with Next.js, Vite, Express/Fastify, Django, FastAPI, Cloudflare Workers, Vercel, GitHub Actions, Docker Compose, monorepos.

## License

MIT for OSS components. See [LICENSE](LICENSE).
