# envmanifest

**The config contract layer for AI-assisted software delivery.**

Declare your app's config once. Reconcile it across code, local files, CI, and deployed providers. Generate signed attestations of what was actually deployed. Free CLI for local checks. Paid cloud adapters and signed seals for deployed config.

> Status: **pre-alpha**, schema v0 (experimental). Not yet published. Watch this repo for the v0.1 launch.

## Quick links

- [Spec (v0)](docs/spec-v0.md) — full design document
- [Schema](packages/schema/manifest.schema.v0.json) — JSON Schema for `manifest.yml`
- [Example manifest](examples/manifest.example.v0.yml) — every v0 feature in one file

## Packages

| Package | Path | Status | License |
|---|---|---|---|
| `envmanifest` (CLI) | `packages/cli` | pre-alpha | MIT |
| `@envmanifest/node` | `packages/node` | pre-alpha | MIT |
| `@envmanifest/next` | `packages/next` | pre-alpha | MIT |
| `@envmanifest/mcp-local` | `packages/mcp-local` | pre-alpha | MIT |
| `@envmanifest/schema` | `packages/schema` | pre-alpha | MIT |
| GitHub Action | `actions/check` | pre-alpha | MIT |

Cloud adapters (Phase 2) will be source-available under BSL 1.1, auto-converting to Apache 2.0 after 2 years.

## Develop

```bash
npm install
npm run build
npm test
```

## License

MIT for OSS components. See [LICENSE](LICENSE).
