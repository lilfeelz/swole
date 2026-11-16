import LightningFS from "@isomorphic-git/lightning-fs";
import git from "isomorphic-git";
import { Buffer } from "buffer";
import { createGitStore } from "../../stores/git.js";
import { createService } from "../../core/service.js";
import {
  createTelemetry,
  consoleSink,
  jsonlSink,
} from "../../core/telemetry.js";
import { mount } from "../../ui/app.js";

/* global SWOLE_SAMPLE */
// isomorphic-git expects Node's Buffer; WebView has none.
globalThis.Buffer ??= Buffer;

// Offline: a git repo in IndexedDB. Syncing with Forgejo waits on an auth decision.
const lfs = new LightningFS("swole");
const fs = lfs.promises;
const dir = "/repo";
const data = `${dir}/data`;
const author = { name: "swole", email: "swole@phone" };

/**
 * Stages every change under the repo and commits it; isomorphic-git runs no git hooks.
 *
 * @param {string} message Commit message.
 * @returns {Promise<void>} Resolves once committed, or at once when nothing changed.
 */
async function commit(message) {
  let changed = false;
  for (const [filepath, head, work, stage] of await git.statusMatrix({
    fs: lfs,
    dir,
  })) {
    if (head === 1 && work === 1 && stage === 1) continue;
    changed = true;
    if (work === 0) await git.remove({ fs: lfs, dir, filepath });
    else await git.add({ fs: lfs, dir, filepath });
  }
  if (changed) await git.commit({ fs: lfs, dir, message, author });
}

const read = (f) => fs.readFile(f, "utf8").catch(() => "");

/**
 * First run: an empty repo seeded with the sample routine until sync exists.
 *
 * @returns {Promise<void>} Resolves once the repo exists.
 */
async function seed() {
  if (await fs.stat(`${dir}/.git`).catch(() => null)) return;
  await git.init({ fs: lfs, dir, defaultBranch: "main" });
  await fs.mkdir(dir).catch(() => {});
  await fs.mkdir(data).catch(() => {});
  await fs.writeFile(`${data}/routine.txt`, SWOLE_SAMPLE.routine, "utf8");
  await commit("init: sample routine");
}

const telemetry = createTelemetry([
  consoleSink(),
  jsonlSink(`${data}/telemetry.jsonl`, {
    appendFile: async (f, line) =>
      fs.writeFile(f, (await read(f)) + line, "utf8"),
  }),
]);
seed().then(() =>
  mount(
    createService({
      store: createGitStore({ fs, dir: data, commit }),
      telemetry,
    }),
  ),
);
