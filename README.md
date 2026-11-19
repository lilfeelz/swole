# swole

One strength-training model and one mobile UI over five storage backends: a local Node
server with git, an Android WebView shell, Google Apps Script, a Cloudflare Worker and a
localStorage demo.

Exercise lines use workline notation:

```text
Deadlift / 2x4 / 140kg
```

Spec, parser and editor support live in [workline/](workline/SPEC.md).

## Quickstart

```sh
git clone https://github.com/lilfeelz/swole.git
cd swole
npm ci
npm run build
python3 -m http.server 4173 --bind 127.0.0.1 -d dist/demo
```

Open <http://127.0.0.1:4173>. The demo keeps state in localStorage, seeded from `sample/`.

## Runtimes

| Runtime | Store                             | Output            |
| ------- | --------------------------------- | ----------------- |
| local   | git tree under `data/`            | `dist/local`      |
| demo    | browser localStorage              | `dist/demo`       |
| apk     | git in IndexedDB                  | `android/`        |
| gas     | Google Sheet `routine`/`log` tabs | `dist/gas`        |
| cf      | Workers KV                        | Worker entrypoint |

```text
src/core/      model, service, HTTP, lifecycle hooks, telemetry
src/runtimes/  local, demo, apk, gas, cf entrypoints
src/stores/    git, browser, KV, spreadsheet adapters
src/ui/        shared HTML/CSS/JS interface
```

## CLI

The CLI commits sessions to the repository, so use it only in a private repository.
`save` pushes when a remote is configured.

```sh
npm run setup                 # installs repository git hooks
node src/cli.js start MONDAY  # commits data/session.txt
node src/cli.js stop          # stamps END and commits
node src/cli.js save          # archives data/log/<yy>/<ww>/<unix>.txt
```

HTTP endpoints: `/api/load`, `/api/start`, `/api/stop`, `/api/save`, `/api/track`.

## Development

```sh
npm run check
npm test
npx playwright install chromium
npm run test:e2e
```

```text
workline/     notation spec, parser, WASM build and nvim support
sample/       public routine and logs used by the demo build
android/      WebView shell and Gradle build
scripts/      bundle, screenshot and bundling helpers
test/         Node unit tests and Playwright scenarios
```

Deployment targets are optional: Android SDK and JDK 17 for the APK, a Cloudflare account
with KV and Wrangler for the Worker, a Google Sheet and clasp for Apps Script.

## License

MIT, see [LICENSE](LICENSE). The workline grammar carries its own copy at
[workline/LICENSE](workline/LICENSE).
