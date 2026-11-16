import {
  parseRoutine,
  parseSession,
  formatSession,
  logPathForSession,
} from "../core/model.js";

/**
 * @typedef {import("../../types/swole.d.ts").Store} Store
 */

/**
 * Creates the file store over a data/ directory, committing every change.
 * Works on Node fs.promises and on isomorphic-git's fs; only `fs` and `commit` differ.
 *
 * @param {object} options Configuration options.
 * @param {any} options.fs Promise fs: readFile, writeFile, mkdir, readdir, unlink.
 * @param {string} options.dir Data directory, e.g. "/repo/data".
 * @param {(message: string) => Promise<void>} [options.commit] Commits the data directory.
 * @param {() => Promise<void>} [options.push] Pushes after a save, when a remote is set.
 * @returns {Store} Git store instance.
 */
export function createGitStore({
  fs,
  dir,
  commit = async () => {},
  push = async () => {},
}) {
  const sessionPath = `${dir}/session.txt`;
  const read = async (f) => {
    try {
      return await fs.readFile(f, "utf8");
    } catch (e) {
      if (e?.code === "ENOENT") return null;
      throw e;
    }
  };
  const mkdirp = async (d) => {
    const parts = d.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const p = parts.slice(0, i).join("/");
      if (!p || (await exists(p))) continue;
      await fs.mkdir(p);
    }
  };
  const exists = async (p) => {
    try {
      await fs.stat(p);
      return true;
    } catch {
      return false;
    }
  };
  /**
   * Lists .txt files under a directory, sorted.
   *
   * @param {string} d Directory.
   * @returns {Promise<string[]>} File paths.
   */
  const walk = async (d) => {
    if (!(await exists(d))) return [];
    const out = [];
    for (const name of (await fs.readdir(d)).sort()) {
      const p = `${d}/${name}`;
      if ((await fs.stat(p)).isDirectory()) out.push(...(await walk(p)));
      else if (name.endsWith(".txt")) out.push(p);
    }
    return out;
  };

  return {
    routine: async () => parseRoutine((await read(`${dir}/routine.txt`)) ?? ""),

    sessions: async () => {
      const list = await Promise.all(
        (await walk(`${dir}/log`)).map(async (f) =>
          parseSession(await read(f)),
        ),
      );
      return list.sort((a, b) => a.startAt?.getTime() - b.startAt?.getTime());
    },

    async append(session) {
      let f = logPathForSession(session, `${dir}/log`);
      while (await exists(f))
        f = f.replace(/(\d+)\.txt$/, (_, t) => `${Number(t) + 1}.txt`);
      await mkdirp(f.slice(0, f.lastIndexOf("/")));
      await fs.writeFile(f, formatSession(session), "utf8");
      if (await exists(sessionPath)) await fs.unlink(sessionPath);
      const id = f.slice(f.lastIndexOf("/") + 1, -4);
      await commit(`log: save session ${id}`);
      try {
        await push();
      } catch (e) {
        console.error(`swole: saved ${id}, push failed: ${e?.message ?? e}`);
      }
      return id;
    },

    getActive: async () => {
      const text = await read(sessionPath);
      return text === null ? null : parseSession(text);
    },

    async setActive(session) {
      if (!session) {
        if (!(await exists(sessionPath))) return;
        await fs.unlink(sessionPath);
        await commit("session: discard");
        return;
      }
      await mkdirp(dir);
      await fs.writeFile(sessionPath, formatSession(session), "utf8");
      const day = String(session.day).toLowerCase();
      await commit(
        session.endAt ? `session: stop ${day}` : `session: start ${day}`,
      );
    },
  };
}
