# envmanifest

**The config contract layer for AI-assisted software delivery.**

Declare your app's config once. Reconcile it across code, local files, CI, and deployed providers. Generate signed attestations of what was actually deployed. Free CLI for local checks. Paid cloud adapters and signed seals for deployed config.

---

## What it is

`envmanifest` is a vendor-neutral configuration contract for applications. One file (`manifest.yml`) declares every env var, secret, and platform binding the app needs, scoped by environment, phase, exposure, and service.

The CLI scans code for config references, validates local and CI state, generates typed runtime loaders, exposes a safe MCP interface for coding agents, and (paid) compares the declared contract against deployed provider state.

When a deployment matches the contract, paid users can generate a **signed config attestation** — a verifiable receipt that a specific commit's deployed key-set satisfied a specific manifest, observed by a specific signing authority at a specific time.

---

## What it isn't

- **Not a secret store.** Use Vault, Doppler, Infisical, AWS SM, GCP SM, 1Password. envmanifest references them.
- **Not a `.env` editor.** The CLI and your IDE are the editors.
- **Not encryption-at-rest.** That's storage's job.
- **Not a full SOC2 platform.** It produces evidence that *supports* configuration and deployment controls. It does not certify your audit.
- **Not a chat interface.** The MCP server is the agent surface.

These boundaries are how the product stays sharp. Resist the urge to grow into any of them.

---

## Why now

Three forces make this the right moment:

1. **Coding agents burn enormous time on env drift.** Every agentic deploy session burns 20+ turns guessing variable names because no machine-readable contract exists across code, dotfiles, and provider state.
2. **Config sprawl is multi-vendor.** Modern apps mix local `.env`, Vercel project envs, Cloudflare Workers bindings, AWS Secrets Manager, and GitHub Actions secrets — usually in the same repo. Per-vendor tools don't reconcile.
3. **Supply-chain attestation is mainstream.** SLSA, in-toto, and Sigstore have established the pattern of signed verifiable evidence about deployed software. Config has been left out of that picture. envmanifest fills that gap.

---

## The contract

Single file at repo root. See `manifest.example.v0.yml` for a full example. Schema is `v0` (experimental); v1 locks after real-world contact with major frameworks and providers.

Key concepts:

| Concept | Values | Purpose |
|---|---|---|
| `kind` | `env` / `secret` / `binding` | Distinguishes plaintext env vars from sensitive values from platform bindings (R2, D1, KV, queues, durable objects). |
| `exposure` | `server` / `public` / `ci` / `client` | Where the resource is allowed to be visible. `public` is safe for client bundles. `ci` is build-only, never in deployed runtime. |
| `phase` | `[build]` / `[runtime]` / `[build, runtime]` | When the resource is needed. Build-time secrets (Sentry tokens) ≠ runtime config (database URLs). |
| `validation.mode` | `presence` / `metadata` / `value_local` / `probe` | Honest about what the contract can actually verify in each environment. Most cloud providers don't expose secret values; the contract has to admit that. |
| `service` | string | Scopes to a service in monorepos. |
| `sources` | array | Where the value comes from in each environment. AWS SM, Vault, Doppler, dotenv, etc. |
| `binding` | object | Provider-specific platform resource (Cloudflare R2 bucket, D1 database). Bindings aren't strings — they're permission+API objects. |

The schema models config as a **resource graph**, not a flat env-var list. This is the difference between handling Cloudflare Workers correctly and being a sad little key counter.

---

## Components

### 1. CLI — `envmanifest` (OSS, MIT)

```
envmanifest init                    # scan code, draft manifest.yml
envmanifest check                   # reconcile manifest ↔ .env* ↔ code
envmanifest scan [--explain]        # list every config reference, with confidence
envmanifest doctor                  # plain-English diagnosis
envmanifest example                 # regenerate .env.example from manifest
envmanifest redact <file>           # safe debug output, secrets masked
envmanifest explain <NAME>          # what is this resource, where does it come from, who owns it
envmanifest generate types          # emit TS types
envmanifest generate dotenv-example # emit .env.example
envmanifest verify-seal <file>      # verify a signed attestation offline
envmanifest ci [--format sarif]     # CI mode, machine-readable
envm                                # short alias
```

The scanner emits **confidence levels**, not pretend-certainty:

```
src/db.ts:12
  ✓ DATABASE_URL — exact reference, required in manifest

src/integrations.ts:44
  ? dynamic env access: process.env[prefix + "_TOKEN"]
  → add a manifest entry or `// envmanifest-ignore-next-line dynamic-env-name`
```

### 2. Runtime loaders (OSS, MIT)

Three modes, escape hatches available:

**Generated module** (preferred, no runtime dependency):
```bash
envmanifest generate ts --out src/env.ts
```
```ts
import { env } from "./env"
env.DATABASE_URL  // typed, validated at boot, fails loudly if missing
```

**Runtime package**:
```ts
import { env } from "@envmanifest/node"
```

**Framework integration**:
```ts
import { createEnv } from "@envmanifest/next"
```

TypeScript first. Python in v0.2. Go and Rust later, demand-driven.

### 3. GitHub Action (OSS, ships in MVP)

```yaml
- uses: envmanifest/check-action@v0
  with:
    environment: production
    format: sarif
```

SARIF output renders findings as GitHub code scanning results. Marketplace listing is the distribution channel.

A small badge for the README:
```
![envmanifest](https://envmanifest.dev/badge/github/org/repo/main.svg)
```

### 4. MCP server (OSS local, paid for cloud-aware)

The agent surface. Tools:

```
envmanifest.list_required(env, service)
envmanifest.validate(env_dict)
envmanifest.explain_requirement(name)
envmanifest.resolve_source(name, env)
envmanifest.list_missing(env, service)
envmanifest.diff_against_deployed(target)   ← paid only
```

**MCP security model is non-negotiable:**

- **Local mode (free):** reads `manifest.yml` and local `.env*`. Never returns values, only names and metadata. Default redaction `partial`.
- **Cloud mode (paid):** queries deployed provider state via scoped, encrypted tokens. Never exposes secret values. Per-repo authorization. Audit log on every tool call. Agent identity included in audit events.
- **Default-deny tool list.** Mutating tools (`mutate_provider`, `read_values`) require explicit policy opt-in.

Names alone leak intent (`MIGRATION_DISABLE_AUTH`, `STRIPE_SECRET_KEY`). The MCP layer treats names as sensitive metadata, not free output.

### 5. Cloud adapters (PAID, source-available BSL)

Read-only sync from deployed config. Priority order driven by user pain:

1. Cloudflare Workers / Pages (you, dogfood)
2. Vercel
3. GitHub Actions secrets
4. AWS Secrets Manager
5. GCP Secret Manager
6. Doppler / Infisical (read-through)

Source-available under BSL 1.1, auto-converts to Apache 2.0 after 2 years. Standard pattern (Sentry, MariaDB, CockroachDB). Prevents same-day cloning while keeping community trust.

### 6. The seal — signed config attestation (PAID, the moat)

**Seal levels.** This is the most important section in the spec. The seal is honest about exactly what it can prove.

| Level | Name | What it claims | What providers must expose |
|---|---|---|---|
| **L0** | Local report | Manifest parsed, local files reconciled. Unsigned. | Nothing. Local-only. |
| **L1** | Local signed | Local key-set matched manifest at commit C. Signed. | Nothing. Local-only. |
| **L2** | Provider presence | Cloud provider exposed required key names for env E at time T. Signed. | Names listable via API. |
| **L3** | Provider metadata | L2 plus metadata: scope, last-updated, environment, branch, project. Signed. | Names + metadata. |
| **L4** | Runtime probe | L3 plus probe results showing config was actually usable. Signed. | All of above + probe execution. |

**What seals do not claim** (ship this in the docs, prominently):

- Seals do not prove secret values were correct.
- Seals do not prove the app actually consumed the resources.
- Seals do not prove credentials worked outside the probe window.
- Seals do not prove config stayed valid after the seal was issued.
- Seals do not prove deployed code matched the sealed commit unless bound to a deployment artifact digest.

This honesty is the marketable feature. Nobody else in this category names what their evidence cannot demonstrate.

**Seal format.** Two outputs from one observation:

**1. Friendly JSON** (for humans, dashboards, support tickets):

```json
{
  "version": 1,
  "level": "L2",
  "project": "ghostlogic-api",
  "repo": "github.com/adam-scott-thomas/ghostlogic",
  "commit": "abc123...",
  "environment": "production",
  "manifest_hash": "sha256:...",
  "key_set_hash": "sha256:...",
  "provider": "cloudflare-workers",
  "provider_project_id": "...",
  "deployment_id": "...",
  "deployment_url": "...",
  "artifact_digest": "sha256:...",
  "required_present": true,
  "drift": [],
  "adapter_version": "0.1.3",
  "cli_version": "0.4.0",
  "schema_version": 0,
  "key_canonicalization": "sorted-utf8",
  "signing_authority": "ghostlogic-tech://seal-v1",
  "signature_key_id": "ed25519:...",
  "signature": "...",
  "observed_at": "2026-04-29T18:22:14Z",
  "expires_at": "2026-07-29T18:22:14Z"
}
```

**2. in-toto Statement** (for supply-chain pipelines, policy engines):

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [
    { "name": "github.com/adam-scott-thomas/ghostlogic", "digest": { "gitCommit": "abc123" } },
    { "name": "registry.example.com/ghostlogic-api", "digest": { "sha256": "..." } }
  ],
  "predicateType": "https://envmanifest.dev/attestation/v1",
  "predicate": {
    "level": "L2",
    "environment": "production",
    "manifest_hash": "sha256:...",
    "key_set_hash": "sha256:...",
    "provider": "cloudflare-workers",
    "required_present": true,
    "drift": [],
    "observed_at": "2026-04-29T18:22:14Z"
  }
}
```

Verifiable offline forever via `envmanifest verify-seal seal.json`. Public key bundled in the runtime loader so verification works even if the company disappears.

### 7. Web dashboard (PAID, Team tier)

Fleet view across repos. Drift alerts. Seal history with filtering and export. SSO. Audit log. Slack/Discord drift webhooks.

Team-tier only. Solo devs don't need a fleet view.

---

## Pricing

| Tier | Price | Who |
|---|---|---|
| **OSS** | Free, MIT | Solo devs, hobbyists, OSS projects |
| **Pro** | **$9/mo** or $90/yr | Working devs, indie hackers, small teams |
| **Team** | **$39/mo flat**, 5 users / 25 repos included, +$5/repo +$5/user | Startups, dev teams |
| **Enterprise** | Custom | SOC2-bound orgs, regulated industries |

### What's free (OSS)

- CLI: every command, fully featured
- Runtime loaders for TypeScript (Python in v0.2)
- Local MCP server
- GitHub Action with SARIF
- `manifest.yml` v0 spec
- Local reconciliation: code ↔ `.env*`
- L0 unsigned local reports
- Self-host any free component

### What's $9/mo (Pro)

- Cloud adapters: Cloudflare, Vercel, AWS SM, GCP SM, GitHub Actions
- L2/L3 signed seals
- Cloud-aware MCP (agents can query deployed state)
- Up to 10 repos
- Email drift alerts
- Seal verification API
- Seal history (90 days)

### What's $39/mo flat (Team)

- Everything in Pro
- 5 users, 25 repos, +$5/seat or repo over
- Fleet dashboard
- Slack/Discord drift webhooks
- SSO (Google, Microsoft, GitHub)
- Audit log
- Seal aggregation across services
- Seal history (1 year)

### What's Enterprise

- L4 runtime probes
- BYO signing authority (on-prem)
- SAML / SCIM
- Custom adapters
- SLA + dedicated support
- Seal export (audit-ready bundles)
- GhostLogic forensic capsule integration (config seals as evidence in incident response)

### Pricing rationale

- **OSS must be excellent**, not crippled. If the free tier is theater, devs sniff it out and adoption dies.
- **Pro at $9/mo** is below the Sunday-DIY threshold for any working dev. Convenience tax on three things devs *could* self-host but won't: signing authority, cloud adapters, cloud-aware MCP.
- **Team at $39 flat** avoids per-seat punishment for orgs where 30 engineers work in a repo but 5 use the dashboard. Closer to monitoring pricing than collaboration pricing.
- **Enterprise sells L4 + BYO signing.** Regulated industries need both.

The agent argument, sharpened: *the human pays $9/mo, the agent saves them 30 minutes on first deploy, the math closes itself.*

---

## Competitive read

| Tool / category | What it does | Sharper distinction |
|---|---|---|
| dotenv-linter (Rust) | Pure syntax linter | No contract, no runtime, no agent surface, no provider reconciliation |
| dotenvx | Encryption + multi-env | `.env` workflow upgrade, no schema, no deployed-state diff |
| t3-env / envalid / Zod-env | Type-safe runtime validation | Per-language only, no cross-source reconciliation, no cloud seal |
| Doppler | Mature secrets store + CLI + audit | Storage/sync-first, not contract/seal-first |
| Infisical | Secrets store + audit trails | Strong storage platform, not deploy attestation |
| Pulumi ESC | YAML environments with provider-backed values | Infrastructure config manager, not code-reference scanner + key-set attestation |
| 1Password Environments | Secret access workflow | Per-developer access flow, not vendor-neutral contract reconciliation |
| HashiCorp Vault | Enterprise secret storage | Heavy infrastructure, no agent surface, no contract concept |
| Vercel / Cloudflare envs | Cloud-side config | Per-vendor, no portability, no contract |
| SLSA / in-toto / Sigstore | Supply-chain attestation standards | Adjacent standard to **integrate with**, not compete against |

**Positioning sentence:**

> Existing tools either store secrets, validate runtime env, or encrypt `.env` files. envmanifest is the missing contract layer: it reconciles code, local files, CI, and deployed provider state, then emits verifiable config attestations.

---

## Security

A `/security` page ships **before any paid feature is enabled**.

### What envmanifest stores

- Resource names
- Provider metadata (scope, environment, last-updated)
- Repo identifiers and commit SHAs
- Manifest hashes (SHA-256 of canonical YAML)
- Key-set hashes (SHA-256 of sorted resource names per environment)
- Drift reports (names only, never values)
- Seal timestamps and signatures

### What envmanifest never stores

- Secret values
- Provider credentials beyond scoped, encrypted access tokens needed for read-only adapter operation
- Customer source code

### Provider permissions requested

- Read-only on env/secret listing
- Read-only on metadata
- No mutation
- Per-environment scoping where the provider supports it

### Signing

- ed25519, public key published at `https://envmanifest.dev/.well-known/seal-public-key`
- Public key bundled in the OSS runtime loader for offline verification
- Key rotation policy: annual, with overlap window
- Past seals remain verifiable forever via key archive

### MCP access model

- Local MCP: zero network, no provider access, names + metadata only
- Cloud MCP: per-repo opt-in, scoped tokens, audit log, names-only by default
- Agent identity recorded in seal audit events

### Probes

- Run in sandboxed subprocess
- Stdout/stderr captured, not surfaced to MCP
- Timeout enforced (30s default)
- Probe commands declared in manifest (no remote execution)

### Disclosure

- Responsible disclosure: `security@ghostlogic.com`
- 90-day coordinated disclosure
- Hall of fame for valid reports

---

## MVP — revised plan

The 4-week launch. OSS-only. No Stripe, no dashboard, no signing authority. Validate the wedge before building the paid surface.

### Week 1 — schema + scanner
- `manifest.yml` v0 schema, JSON Schema published
- `envmanifest init` (scan code, draft manifest)
- `envmanifest scan` (with confidence levels)
- `envmanifest check` (code ↔ `.env*` reconciliation)
- TypeScript/JavaScript scanner (regex + AST)
- npm + PyPI namespace claimed
- GitHub repo public

### Week 2 — runtime + CI
- `envmanifest example` (regenerate `.env.example`)
- `envmanifest doctor` (plain-English diagnostics)
- `envmanifest generate types` (TS types from manifest)
- TypeScript runtime loader (`@envmanifest/node`)
- GitHub Action (`envmanifest/check-action@v0`) with SARIF
- README with Next.js + Cloudflare Workers examples

### Week 3 — agent surface + framework hooks
- Local MCP server (no cloud access)
- `@envmanifest/next` framework integration
- Monorepo example
- L0 unsigned local report format
- in-toto Statement format prototype

### Week 4 — launch
- `envmanifest.dev` landing page (deferred until validated; until then, GitHub README is the site)
- Show HN post: "envmanifest — env drift checks for agentic coding workflows"
- `/r/programming`, `/r/typescript`, `/r/devops`
- X launch thread

### Validation gate before paid build

After 4 weeks of OSS-only:

- **>50 GitHub stars, real issues, ≥10 adopters, "I'd pay for this" inbound** → buy `envmanifest.dev`, build Phase 2.
- **Crickets** → cost was time, not money. Pivot energy back to GhostLogic.

### Phase 2 — first paid proof (only if validated)

- Cloudflare Workers adapter (read-only)
- Vercel adapter (read-only)
- `envmanifest diff --provider cloudflare`
- L2 seal generation (signed, hosted authority on `seal.ghostlogic.com`)
- `envmanifest verify-seal` (offline)
- Stripe payment links
- Pro tier turned on

### Phase 3 — team product

- Fleet dashboard
- Slack/Discord webhooks
- Audit log
- SSO
- Seal aggregation
- L3 seals

### Phase 4 — enterprise

- L4 runtime probes
- BYO signing authority
- Custom adapters
- GhostLogic capsule integration

---

## Naming and namespace

- **Domain:** `envmanifest.dev` (defer purchase until Phase 2 validation gate)
- **Until then:** GitHub repo serves as canonical home (`github.com/envmanifest/envmanifest` or `github.com/ghostlogic-tools/envmanifest`)
- **CLI:** `envmanifest` canonical, `envm` alias
- **npm scope:** `@envmanifest` (claim immediately, free)
- **PyPI:** `envmanifest` (claim immediately, free)
- **GitHub org:** `envmanifest` (claim immediately, free)

---

## Schema versioning policy

- **v0:** experimental. Breaking changes allowed. No stability promise.
- **v0 → v1 transition criteria:** validated against Next.js, Vite, Express/Fastify, Django, FastAPI, Cloudflare Workers, Vercel, GitHub Actions, Docker Compose, monorepos, mixed frontend/backend repos.
- **v1:** stable. Future changes are additive only.
- **v0 lifetime cap:** 6 months from launch, or 100 active users, whichever comes first. Schemas that stay experimental forever signal an unfinished product.
- **Migration:** `envmanifest migrate --from v0 --to v1` ships with v1 release.

---

## Anti-features — do not build

- Secret value storage
- Web UI for editing `.env`
- Value encryption at rest
- Auto-fix on drift (envmanifest reports and signals; humans and agents fix)
- Per-language config DSLs (one YAML, multiple loaders)
- A chat interface (the MCP server is the agent surface)

---

## The moat, restated

The defensible asset is not "we have a CLI." It is:

> Developer adoption of the contract format, plus trusted cloud observations, plus seal verification that fits existing supply-chain workflows (in-toto, SLSA), with a clear and honest statement of exactly what each seal level can and cannot prove.

If the manifest format becomes useful locally, agents and CI pull it into workflows. Then paid cloud diff and seals become natural. If the format feels heavy, the seal never matters because adoption stalls before users reach the expensive part.

The OSS CLI must be excellent. Not "works." Excellent.

---

## Landing page hero

When the domain is bought, this is the copy.

**Hero:**
> Your `.env` is lying. Catch it before prod.

**Subhead:**
> Declare your app's config contract once. Validate code, CI, local files, and deployed providers. Generate signed attestations when production actually matches. Free CLI. Paid cloud adapters and signed seals.

**Three-up below:**

| For developers | For agents | For compliance |
|---|---|---|
| Type-safe env loaders, drift detection in CI, plain-English diagnostics. | An MCP interface that tells coding agents exactly what config the app needs — no more 20-turn guessing. | Signed config attestations that fit in-toto / SLSA workflows. Audit-ready evidence for configuration and deployment controls. |

**Footer:**
> envmanifest does not store secret values. It defines, validates, and attests the contract around them.

---

## Open questions parked for later

1. Self-host the dashboard? Team yes (cloud-hosted), Enterprise yes (on-prem option). Pro is CLI-only.
2. Plugin API for custom adapters? Yes, but v0.3+. Not needed for launch.
3. License: MIT (CLI, runtime, MCP local). BSL 1.1 → Apache 2.0 after 2 years (cloud adapters). Closed (signing service, dashboard backend, seal verification API).
4. Probe sandboxing model: subprocess + timeout + non-root + no network by default? Likely yes, harden later.
5. Imports/manifest fragments: punt to v0.2.

---

## Final framing

This is the **config contract layer for AI-assisted software delivery**. Not "dotenv linter with receipts." Not "another env validator." A category-shaped product whose OSS surface drives adoption, whose paid surface sells trust evidence, and whose long-term value compounds with the rise of coding agents that need machine-readable config contracts to stop wasting human time.

Ship the wedge. Validate. Build paid only after the OSS earns its place.
