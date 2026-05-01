# @envmanifest/schema

JSON Schema and TypeScript types for the [envmanifest](../../README.md) contract.

## Install

```bash
npm install @envmanifest/schema
```

## Use

```ts
import { manifestSchemaV0, type Manifest } from "@envmanifest/schema";
```

The raw JSON Schema is also exported for use with `ajv`, `yaml-language-server`, etc.:

```ts
import schema from "@envmanifest/schema/manifest.schema.v0.json";
```

Or via URL (CDN-served once published):

```yaml
# yaml-language-server: $schema=https://env.ghostlogic.tech/schemas/v0/manifest.schema.json
```

## Schema versioning

- **v0:** experimental. Breaking changes allowed. No stability promise.
- **v1:** stable, future changes additive only.
- v0 lifetime cap: 6 months from launch, or 100 active users, whichever comes first.

## License

MIT
