# swole showcase

## 1. Purpose

swole is a single-user strength-training logger with one JavaScript model and one mobile web UI mounted on five runtimes: a local Node server over a git repository, an Android WebView shell over an IndexedDB git repo, a Google Apps Script web app over a Sheet, a Cloudflare Worker over KV, and a localStorage demo seeded from `sample/`. Exercise lines use workline notation (`Deadlift / 2x4 / 140kg`), implemented as a shared tree-sitter grammar with a written spec, conformance vectors, canonical serialization, and an nvim runtime. The CLI writes and commits sessions under `data/`, and the service fires lifecycle hooks on start, stop and save. It is for a lifter who wants plain-text, self-hosted, offline-tolerant logs, and for developers interested in the workline grammar or in a compact example of one UI and service contract over five storage backends.

## 2. Demo artifact

The smallest real demonstration is the committed `docs/screenshot.png` used at the top of `README.md`: a Pixel 5 viewport showing the Monday sample routine, a filled set, an invalid RPE with its parse-error popover open, and the disabled Save action.

Documented reproduction (not executed during this prep; see section 6):

```sh
npm ci
npm run build
npx playwright install chromium
npm run screenshot
```

`scripts/screenshot.js` serves `dist/demo`, fills `#list .row input`, clicks the invalid row name to open the error popover, asserts `#save` is disabled, and writes `docs/screenshot.png`. The live equivalent, after the same install and build:

```sh
npm run serve
# http://127.0.0.1:4173
```

`serve` only serves an existing `dist/local` and prints the build hint after binding (`src/cli.js:146-193`).

## 3. README gaps

- No prerequisites section. `package.json` requires Node >=22; CI uses Node 24; the screenshot and e2e tests need Playwright Chromium; the e2e static server calls `python3` (`playwright.config.js:4`); the APK needs JDK 17 and an Android SDK.
- No quickstart for the UI demo. `npm run serve` is listed, but not that `npm run build` must run first and that the served bundle is `dist/local`.
- Verification is undocumented. `npm run check`, `npm test`, and `npm run test:e2e` exist; e2e needs browsers installed and binds ports 4173 and 4174.
- No architecture map. Nothing explains `src/core` (model, service, http, hooks, telemetry), the Store contract in `types/swole.d.ts`, the four store implementations, or the five runtimes under `src/runtimes`.
- workline is under-described. The spec link is there, but the README does not mention `workline/vectors.json`, canonical round-tripping, the nvim runtime, or that grammar changes require `npm run build:grammar` and `workline/nvim/build.sh`.
- The local data workflow is undocumented. Readers cannot see the `DAY`/`START`/`END` session format, the `data/log/<yy>/<ww>/<unix>.txt` layout, the active-session file, or that saves auto-commit and push when a remote exists.
- Deploy prerequisites are missing: creating the KV namespace and binding, preparing the Google Sheet with `routine` and `log` tabs, clasp authentication, the fixed deployment, Pages settings, and `git-filter-repo` for `npm run mirror` (`scripts/mirror.sh:13`).
- Docs drift: `workline/SPEC.md:128` says `scripts/migrate-legacy.js` applies the legacy migration and that usage is in the README, but that script is absent and the README has no migration section.
- No license statement at the root. `package.json` says `UNLICENSED` and `private`, while `workline/LICENSE` is MIT; a reader cannot tell what applies to the app, the grammar, and the sample data.
- No data or privacy note. Local runs append telemetry to `data/telemetry.jsonl` (`src/cli.js:32-35`); sessions can live in a git remote, Workers KV, a Google Sheet, or browser storage.
- No support or contribution pointer beyond the in-app feedback modal, which targets `github.com/lilfeelz/swole/issues`.
- The screenshot alt text ("swole on a phone") and surrounding text do not say which viewport, day, or error state the image shows.
- The README's APK install example embeds a private device address; that should be a placeholder in a public document.

## 4. License

Current status: no root `LICENSE`; `package.json` declares `"license": "UNLICENSED"` and `"private": true`. The checked-in `workline/` directory carries an MIT license (`workline/LICENSE`, `workline/tree-sitter.json`). The sample logs and the app code therefore have no public reuse grant while the grammar does.

Recommendation: add a root `LICENSE` and set the package license to MIT, matching workline. Tradeoff: MIT lets others reuse and redistribute the whole app and demo, which suits a showcase but gives up exclusive rights to the application code.

## 5. Maintenance

- Toolchain: Node >=22 (CI uses 24), npm lockfile, TypeScript check over jsconfig, Prettier, ESLint, node:test, Playwright Chromium, and Python 3 for the e2e static server must keep working.
- workline artifacts must stay in sync: `workline/grammar.js` generates `src/parser.c`, the two checked-in wasm files, the nvim native parser, and the highlight query. Regenerate with `npm run build:grammar` and `workline/nvim/build.sh`; `test/workline-vectors.test.js` and the highlight test enforce conformance.
- The sample fixtures are behavior, not decoration. `sample/routine.txt` and `sample/log/**` drive the demo and are asserted canonical; e2e tests assert the exact Monday and Thursday exercise lists, schemes, and last-load hints.
- The screenshot script depends on UI selectors (`#day`, `#list .row input`, `.row.invalid .name`, `#save`), the Pixel 5 device profile, and the invalid-line popover behavior. UI changes require updating the script and the committed PNG.
- Local persistence depends on the CLI's auto-commit path and the git hooks. Note that `.gitignore:8` ignores `/data/*` while `src/cli.js:105-107` stages with `git add -A -- data` without `-f`; verify in a real checkout that new sessions and logs are actually committed.
- The GitHub mirror must stay deterministic: `scripts/mirror.sh` filters `data/`, refuses any remaining `data/` or `.clasprc.json`, and force-updates main and tags. Its default remotes are owner-specific.
- Deploy paths must stay aligned: `.clasp.json` rootDir must match `dist/gas`; the Apps Script workflow needs `CLASPRC_JSON` and the fixed deployment ID; the Worker needs the `SWOLE_KV` binding; Pages publishes `dist/demo`; the APK workflow builds a debug APK and attaches it to `v*` tags.
- CI runs on the GitHub mirror, not Forgejo; the Forgejo gate is the pre-push hook, which runs check and tests only when the push carries code outside `data/`.
- Pinned action SHAs, `clasp@3.4.1`, and the lockfile must be kept current enough for CI and deploys to run.

## 6. Unknowns, verify

- The live Pages, Apps Script, Worker, and APK release state is unverified. No network access was used.
- The four-step reproduction in section 2 was not run here because `node_modules/` and `dist/` are absent and installs are out of scope. Confirm it reproduces the committed PNG.
- `npm run check`, `npm test`, and `npm run test:e2e` were not run at this commit. Confirm they pass on a clean install.
- Confirm whether `/data/*` in `.gitignore` blocks new `data/session.txt` and `data/log/**` files from the CLI's auto-commit in the real Forgejo checkout, or whether those paths are force-added there.
- Confirm whether `scripts/migrate-legacy.js` was intentionally removed; `workline/SPEC.md` still references it.
- Confirm the intended canonical home for workline. The nvim and spec files point at `JakobMelchard/workline`, the README and app point at `lilfeelz/swole`, and `workline/index.js` comments mention an `@jakobmelchard/workline` package.
- Confirm the oldest supported Node version: engines says >=22, CI uses 24, and this clone runs 26.
- Confirm which Wrangler version is expected for the committed `compatibility_date`; Wrangler is invoked with `npx` and is not pinned in `package.json`.
- Confirm the owner is comfortable publishing the account-scoped Apps Script script ID, web app deployment ID, and KV namespace ID (see section 7).
- Confirm the Forgejo history never contained `data/` or `.clasprc.json` before the mirror filter; this clone cannot show the private history.
- Confirm whether the GAS web app should remain `access: MYSELF` (`src/runtimes/gas/appsscript.json`) if the showcase claims a live Apps Script demo.

## 7. Publication readiness (clasp.json and wrangler.toml)

Verdict: no credentials are committed in either file; the repo is publication-ready as a personal showcase if the owner accepts public association with the owner-scoped IDs. It is not ready to serve as a reusable public template until those IDs and the other owner-specific paths are parameterized.

Safe to keep public, from a credential standpoint:

- `.clasp.json:2` script ID. It identifies an Apps Script project but is not a token; pushes still require the owner's clasp credentials. The web app is deployed with `access: MYSELF` and `executeAs: USER_DEPLOYING`, so the ID does not expose a public endpoint.
- `.clasp.json:3` `rootDir: "dist/gas"`. Build configuration only.
- `wrangler.toml` worker `name`, `main`, `compatibility_date`, and the `[assets]` directory/binding/`run_worker_first` block. No account ID is present.
- `wrangler.toml:13-14` binding name `SWOLE_KV` and the KV namespace ID. The ID is account-scoped, not a secret; it cannot be read or written without the owner's Cloudflare credentials.

Must move out or be parameterized:

- `wrangler.toml:14` contains a real KV namespace ID rather than the placeholder the README implies. Replace it with a placeholder or generate the file from a deploy variable so forks do not target the owner's namespace.
- `.clasp.json:2` contains the real script ID. Keep it only for owner deploys. For a public template, ship `.clasp.example.json` and generate `.clasp.json` in CI from a repository variable, or ignore the real file.
- `.github/workflows/deploy-gas.yml:46` hardcodes the live web app deployment ID. This is not a credential, but it ties every deploy to the owner's deployment and makes forks fail. Move it to a repository variable such as `vars.GAS_DEPLOYMENT_ID`.
- `README.md:38` embeds a private device address for ADB. Replace it with a placeholder such as `<device-serial>`.
- `scripts/mirror.sh:6-7` defaults to the owner's Forgejo and GitHub SSH endpoints. Require arguments or environment variables in a public copy.
- `workline/nvim/README.md:18,24` uses an absolute path under the owner's home directory. Replace with `/path/to/swole/workline/nvim`.

Other publication checks: `git ls-files` shows no `.env`, token, credential, or `.clasprc.json` files, and a tracked-file scan found no private keys or common token patterns. The only credential-like string in the repo is the Apps Script deployment ID, which is a public web app address, not a secret. The mirror script explicitly refuses `.clasprc.json` and any `data/` path.
