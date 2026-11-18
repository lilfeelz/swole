# swole

## Purpose

- Demonstrates one workout model and UI across five storage/runtime adapters, with portable text data and offline support.
- Exercise notation: `Deadlift / 2x4 / 140kg`; parser and editor support live in [workline/](workline/SPEC.md).

## Usage

Run the sample-data demo without credentials or workout commits:

```sh
git clone https://github.com/lilfeelz/swole.git
cd swole
npm ci
npm run build
python3 -m http.server 4173 --bind 127.0.0.1 -d dist/demo
```

- Open `http://127.0.0.1:4173`; demo state stays in this browser's localStorage, seeded from `sample/`.
- Local: `npm run serve` serves UI/API at `127.0.0.1:4173`; Git stores sessions in `data/`.
- APK: Android WebView, offline Git repository in IndexedDB; GAS: Google Sheet `routine`/`log` tabs; CF: Workers KV.
- Build outputs: `dist/{local,demo,apk,gas}` plus Android assets; CF uses its runtime entrypoint directly.
- Use local CLI only in a private repository: it commits workout data and `save` pushes if a remote is configured.

```sh
npm run setup                # installs repository Git hooks
node src/cli.js start MONDAY # commits data/session.txt
node src/cli.js stop         # stamps END and commits
node src/cli.js save         # archives data/log/<yy>/<ww>/<unix>.txt, commits, may push
```

- HTTP POST endpoints: `/api/load`, `/api/start`, `/api/stop`, `/api/save`, `/api/track`; start accepts optional `day`.
- Local telemetry appends call names, durations, outcomes, counts and error strings to `data/telemetry.jsonl`.
- `data/`, including telemetry, can be committed into the private primary. No third-party telemetry call is made by the local CLI.
- Public mirror strips `data/` history. `npm run mirror` filters/checks a temporary clone before pushing main/tags, but current preparation metadata prevents fast-forwarding; do not force-push. Realignment needs owner approval.

## Layout

```text
src/core/            # shared model, service, HTTP, hooks and telemetry
src/ui/              # shared HTML/CSS/JS interface
src/runtimes/        # local, demo, APK, Apps Script and Worker entrypoints
src/stores/          # Git, browser, KV and spreadsheet adapters
src/cli.js           # local HTTP server, session commands and Git hooks
workline/            # notation specification, parser, WASM and editor support
sample/              # public routine and logs used by demo builds
android/             # WebView APK shell and Gradle build
scripts/             # bundles, screenshot generation and filtered mirroring
test/                # Node unit tests and Playwright browser scenarios
.github/workflows/   # GitHub CI, Pages, Apps Script and APK automation
```

## Operate

- Owner: lilfeelz. Private primary owns workout history; GitHub is a filtered code/sample mirror.
- CI: GitHub runs check/build/unit/browser tests; private primary uses pre-push check/tests for code changes.
- Demo deploy: `pages.yml` publishes `dist/demo`; APK workflow builds debug-signed artifacts and attaches them on `v*` tags.
- GAS deploy: manually dispatch `deploy-gas.yml`; requires secrets `CLASPRC_JSON`, `CLASP_SCRIPT_ID` and variable `GAS_DEPLOYMENT_ID`. No live deploy tested; each production deploy needs owner approval.
- Worker: create a namespace with `npx wrangler kv namespace create SWOLE_KV`, set its ID in ignored `wrangler.local.toml`, then `npx wrangler deploy -c wrangler.local.toml`.
- Apps Script config: copy `.clasp.example.json` to ignored `.clasp.json`, supply your own script ID; never commit credentials.
- Rollback: restore a prior source revision and redeploy the selected backend; no unified rollback command or automatic data rollback.

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Dependencies

- Node.js 22+, npm; Python 3 for demo serving/browser tests; Chromium for Playwright.
- Runtime: isomorphic-git, lightning-fs, buffer, web-tree-sitter; tooling: esbuild, TypeScript, ESLint, Prettier, Playwright.
- Optional targets: Android SDK/JDK 17, Cloudflare account/KV/Wrangler, Google Sheet/Apps Script/clasp; mirroring needs git-filter-repo.

## Status

- Live: five tested runtime adapters, private workout primary and filtered public code/sample mirror; deployed endpoints unverified. Planned: retain the showcase and realign mirroring, no new service.
