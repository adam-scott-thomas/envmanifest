# site

Cloudflare Worker that serves `env.ghostlogic.tech` — schemas, `.well-known` endpoints, and a tiny landing page.

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

> **Adam runs this — do not auto-deploy.** It mounts `env.ghostlogic.tech` as a Cloudflare Custom Domain on the `envmanifest-site` Worker. DNS for `env.ghostlogic.tech` must already point to Cloudflare (it does — `ghostlogic.tech` is on Cloudflare).

```bash
cd site

# 1. Authenticate. Either log in interactively...
npx wrangler login

# ...or use the existing 1Password-stored API token (preferred, unattended):
export CLOUDFLARE_API_TOKEN=$(op read "op://ghostlogic.tech/Cloudflare Zone Edit DNS Token/credential")
export CLOUDFLARE_ACCOUNT_ID=$(op read "op://ghostlogic.tech/Cloudflare Account ID/credential")
# (Verify the actual op:// path in 1Password before running — those are the expected item names.)

# 2. First-time deploy. wrangler will prompt to attach the custom domain.
npx wrangler deploy

# 3. Verify
curl -i https://env.ghostlogic.tech/health
curl -i https://env.ghostlogic.tech/schemas/v0/manifest.schema.json | head
```

## What this is not

- **Not the marketing site.** When `envmanifest.dev` is bought (Phase 2 validation gate), that's where the marketing copy goes. This is a tools-only host.
- **Not a registry / no DB.** Stateless Worker, ETag-cached. Schema content is bundled at build time from `@envmanifest/schema`.

## License

MIT
