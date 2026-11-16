# swole

One workout logger with one UI and one model in JS, running on five backends. Exercise lines use [workline](workline/SPEC.md) notation: `Deadlift / 2x4 / 140kg`.

| Runtime | Store                                         | Where                          |
| ------- | --------------------------------------------- | ------------------------------ |
| local   | git repo, `data/`                             | `npm run serve`, CLI           |
| apk     | git repo in IndexedDB (isomorphic-git)        | Android WebView shell, offline |
| gas     | gswole Google Sheet, `routine` and `log` tabs | Apps Script web app            |
| cf      | Workers KV                                    | Cloudflare Worker              |
| demo    | localStorage, seeded from `sample/`           | GitHub Pages                   |

## Use

```sh
npm ci
npm run setup                 # core.hooksPath=.githooks
npm run build                 # dist/{local,demo,apk,gas}, android assets
node src/cli.js start MONDAY  # writes and commits data/session.txt
node src/cli.js stop          # stamps END, commits
node src/cli.js save          # moves it to data/log/<yy>/<ww>/<unix>.txt, commits, pushes if a remote is set
npm run serve                 # UI and api on 127.0.0.1:4173
```

The service fires post-start, post-stop and post-save. Git hooks cover manual git use: pre-commit validates `data/` lines, post-commit fires the lifecycle event, and pre-push runs check and tests when the push carries code.

## Data and mirror

`data/` lives on Forgejo only. `npm run mirror` filters it out of a temp clone and pushes `main` and tags to GitHub. It refuses to push if any `data/` path or `.clasprc.json` remains.

## Deploys

- Apps Script: `deploy-gas.yml` runs `clasp push` and redeploys the fixed web app deployment. It needs the `CLASPRC_JSON` secret.
- APK: `apk.yml` builds a debug APK and attaches it to a release on a `v*` tag. Install with `adb -s 100.100.214.100:5555 install app-debug.apk`.
- Worker: put the KV namespace id in `wrangler.toml`, then `npx wrangler deploy`.
- Demo: `pages.yml` publishes `dist/demo`.
