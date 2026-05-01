# @envmanifest/mcp-local

Local MCP server that exposes your `manifest.yml` to coding agents — names and metadata only, **never values**.

```bash
npm install -g @envmanifest/mcp-local
```

Configure your MCP client (Claude Code, etc.) to spawn `envmanifest-mcp` from your project root. The server reads `manifest.yml` from `cwd`.

## Tools

| Tool | What it returns |
|---|---|
| `list_required(env, service?)` | Required resources for the env, with kind/exposure/type metadata |
| `validate(env, presentNames, service?)` | Which presented names are missing/forbidden/unknown |
| `explain_requirement(name)` | Full metadata for one resource (phase, deprecation, rotation, tags) |
| `resolve_source(name, env)` | Provider list and optional refs (e.g. `aws-sm://...`) for the env |
| `list_missing(env, presentNames, service?)` | Convenience: just the missing names |

## Security model

- **Never returns secret values.** Period.
- **Default redaction is `partial`**: names matching `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*`, `*PRIVATE*`, `*CREDENTIAL*`, `*AUTH*` are masked to `XXX...`. Override per project via `policies.mcp.redaction` in the manifest (`off` / `partial` / `full`).
- **Default-deny on mutating tools.** `read_values` and `mutate_provider` are not exposed by the local server. The cloud MCP (paid) extends the surface but keeps the same default-deny posture.
- **No network.** Local mode reads `manifest.yml` and nothing else. No provider calls.

## Manifest policy

```yaml
policies:
  mcp:
    expose:
      names: true
      provider_metadata: true
      values: false           # cannot be true; the server ignores it
    redaction: partial
    allowed_tools: [list_required, validate, explain_requirement, resolve_source]
    denied_tools: [read_values, mutate_provider]
```

## License

MIT
