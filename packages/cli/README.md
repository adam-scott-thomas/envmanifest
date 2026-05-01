# envmanifest

CLI for the [envmanifest](https://github.com/adam-scott-thomas/envmanifest) config contract.

```bash
npm install -g envmanifest
```

## Commands

```
envmanifest init                     # scan code, draft manifest.yml
envmanifest scan [--explain]         # list every config reference, with confidence
envmanifest check [--env <name>]     # reconcile manifest ↔ .env* ↔ code
envmanifest doctor                   # plain-English diagnosis
envmanifest example                  # regenerate .env.example from manifest
envm                                 # short alias
```

Status: pre-alpha, all commands stub-only. Week 1 of MVP.

## License

MIT
