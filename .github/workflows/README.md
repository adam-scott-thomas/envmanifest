# Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push / PR to main | typecheck, build, test, action-bundle freshness check, dogfood `envmanifest doctor` against this repo |
| `publish-npm.yml` | tag `v*` push, or manual dispatch | Publish all five npm packages in dependency order (`schema → node → next → mcp-local → cli`) with `--provenance` |

## Publishing — first time

1. Set the `NPM_TOKEN` repository secret (`Settings → Secrets and variables → Actions`). Use a granular publish token with publish access to the `@envmanifest` org and the `envmanifest` package.
2. Create the `npm-publish` GitHub Environment (`Settings → Environments`) and require approval. The workflow uses this environment so a human has to click before any actual publish.
3. Bump root + every package to `0.1.0`:
   ```bash
   npm version 0.1.0 --workspaces --no-git-tag-version
   npm version 0.1.0 --no-git-tag-version
   git add -A
   git commit -m "chore: 0.1.0"
   git tag v0.1.0
   git push --follow-tags
   ```
4. The workflow runs on the tag push.

## Publishing — dry run

```
gh workflow run publish-npm.yml -f dry-run=true
```

`--dry-run` exercises everything except the registry POST. Use it to verify the order, the version pin, and the provenance config.
