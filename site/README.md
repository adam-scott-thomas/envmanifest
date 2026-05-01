# site

Cloudflare Worker that serves [env.ghostlogic.tech](https://env.ghostlogic.tech) — schemas, `.well-known` endpoints, and a tiny landing page.

**Status:** live as of 2026-05-01. Probe: `curl https://env.ghostlogic.tech/health` → `ok`.

## Endpoints

| Path | Purpose |
|---|---|
| `/` | Tiny landing page with usage instructions |
| `/schemas/v0/manifest.schema.json` | The `v0` manifest JSON Schema, served from `@envmanifest/schema` |
| `/.well-known/seal-public-key` | Placeholder for the L1+ ed25519 signing public key (Phase 2) |
| `/health` | Uptime probe |

## Develop

```bash
cd site
npm install
npm run typecheck
npm run dev          # local wrangler dev
```

## Deploy

`env.ghostlogic.tech` is on Cloudflare and DNS is auto-managed by wrangler via the `custom_domain: true` route. The Worker requires a CF API token with the **"Edit Cloudflare Workers"** template scope (Account: Workers Scripts: Edit + Zone: Workers Routes: Edit + User: User Details: Read). The DNS-only "Cloudflare Zone Edit DNS Token" in `ghostlogic.tech` 1P vault is **not sufficient** — needs the broader Workers token.

```powershell
cd D:\lost_marbles\envmanifest\site

# Use the broader CF Workers token from 1Password
$env:CLOUDFLARE_API_TOKEN = (op read "op://ghostlogic.tech/Cloudflare Workers Deploy Token/credential")
$env:CLOUDFLARE_ACCOUNT_ID = (op read "op://ghostlogic.tech/Cloudflare Account ID/credential")

npx wrangler deploy

# Verify
curl https://env.ghostlogic.tech/health
curl https://env.ghostlogic.tech/schemas/v0/manifest.schema.json | head
```

## What this is not

- **Not the marketing site.** When `envmanifest.dev` is bought (Phase 2 validation gate), that's where the marketing copy goes. This is a tools-only host.
- **Not a registry / no DB.** Stateless Worker, ETag-cached. Schema content is bundled at build time from `@envmanifest/schema`.

## License

MIT
