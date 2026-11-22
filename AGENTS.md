# swole

Workout logger with one UI/model in JS across five runtimes (`local`, `apk`, `gas`, `cf`, `demo`) and `workline` set notation (`workline/SPEC.md`).

## Workflow

- Forgejo (`origin`) is primary; `data/` stays off GitHub. `npm run mirror` runs `scripts/mirror.sh` (`git filter-repo --invert-paths --path data/`) to push `main` and tags to `github`.
- GitHub CI runs on the mirror; Forgejo gates pushes with `.githooks/pre-push` (`npm run setup`).

## Commands

```sh
npm run check          # tsc -p jsconfig.json, prettier --check ., eslint .
npm test               # node --test unit + conformance suite
npm run build          # dist/{local,demo,apk,gas} + android assets
npm run build:grammar  # regenerate workline parser + wasm from workline/grammar.js
workline/nvim/build.sh # rebuild native Neovim parser from workline/src/parser.c
```
