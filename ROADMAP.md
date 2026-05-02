# Roadmap

## Shipped — v0.1 (npm)

- TypeScript / JavaScript scanner with confidence levels (`exact` / `template` / `dynamic`)
- Commands: `init`, `scan`, `check`, `doctor`, `example`, `generate-types`, `explain`, `redact`, `verify-seal`
- `@envmanifest/node` runtime loader (typed, fail-loud)
- `@envmanifest/next` framework integration with server / client leak guards
- `@envmanifest/mcp-local` MCP server for Claude Code, Cursor, and other MCP-aware coding agents — names + metadata only, never values
- GitHub Action with SARIF output for code-scanning
- Cloudflare `wrangler.toml` / `wrangler.jsonc` binding parser (R2, D1, KV, queues, durable objects, AI, vectorize, hyperdrive, services, assets)
- L0 unsigned reports + in-toto Statement v1 prototype
- Schema host live at <https://env.ghostlogic.tech>

## Next — v0.2 (~2 weeks from v0.1 publish)

See [docs/v0.2-plan.md](docs/v0.2-plan.md). Ranked priorities:

1. **Python scanner** — stdlib (`os.environ`, `os.getenv`), pydantic-settings BaseSettings, django-environ. Three of five test projects are Python-primary; v0.2 unblocks them.
2. **Dotenv fallback for `init`** — when scanner returns 0 references but `.env*` exists, draft from dotenv names. Adds a `confidence: exact | inferred | dynamic` field to the manifest schema.
3. **Multi-env file precedence** — `.env.{env}.local > .env.local > .env.{env} > .env`, with attribution per name in `doctor` output.
4. **Multi-component repo detection + `workspace.yml`** — refuse to mash a Python+TS+Rust monorepo into one root manifest; offer to generate `workspace.yml` pointing at per-component manifests.

Plus: an opt-in `envmanifest feedback` command that pre-fills a GitHub issue with anonymized scan stats so v0.2 priorities re-validate against real adopters, not just the author's five-project sample.

## Slip plan

If Python + dotenv-fallback alone take Week 1, ship `v0.1.1` with just those two and defer the rest to `v0.2.0`. Hard cap at week 4.

## Phase 2 — paid

Cloud adapters (Cloudflare Workers, Vercel, AWS SM, GCP SM, GitHub Actions secrets), signed L2 / L3 seals via Ghost_Logic Blackbox, fleet dashboard with drift alerts. See [docs/spec-v0.md](docs/spec-v0.md) for the full Phase 2 picture.

## Deferred

Explicitly **not** in v0.2:

- `kind: service` — no dogfood demand surfaced; revisit in v0.3 if Team-tier customers ask
- Go scanner, Rust scanner — no project pull yet
- Seal level L4 (runtime probes) — Phase 2
- Schema v0 → v1 lock — at least 6 months or 100 active users, whichever first
