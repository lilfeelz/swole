import path from "node:path";
import {
  parseRoutine,
  parseSession,
  formatSession,
  logPathForSession,
} from "../core/model.js";

/**
 * @typedef {import("../../types/swole.d.ts").Store} Store
 * @typedef {import("../../types/swole.d.ts").Session} Session
 * @typedef {import("../../types/swole.d.ts").Routine} Routine
 */

/**
 * Recursively scans directory for .txt log files.
 *
 * @param {any} fs File system promises interface.
 * @param {string} dir Directory path.
 * @returns {Promise<string[]>} Array of file paths.
 */
async function scanLogFiles(fs, dir) {
  const files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await scanLogFiles(fs, fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith(".txt")) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    if (/** @type {any} */ (err).code !== "ENOENT") {
      throw err;
    }
  }
  return files;
}

/**
 * Creates a Git/File-backed Store using Node fs or isomorphic-git/lightning-fs.
 *
 * @param {object} options Configuration options.
 * @param {any} options.fs File system promises interface.
 * @param {string} options.dir Base data directory (e.g. "data" or "sample").
 * @param {string} [options.routinePath] Path to routine.txt.
 * @param {string} [options.sessionPath] Path to active session.txt.
 * @returns {Store} Git store instance.
 */
export function createGitStore({
  fs,
  dir,
  routinePath = path.join(dir, "routine.txt"),
  sessionPath = path.join(dir, "session.txt"),
}) {
  const logDir = path.join(dir, "log");

  return {
    async routine() {
      try {
        const content = await fs.readFile(routinePath, "utf8");
        return parseRoutine(content);
      } catch (err) {
        if (/** @type {any} */ (err).code === "ENOENT") {
          return {};
        }
        throw err;
      }
    },

    async sessions() {
      const files = await scanLogFiles(fs, logDir);
      /** @type {Session[]} */
      const list = [];
      for (const file of files) {
        try {
          const content = await fs.readFile(file, "utf8");
          const session = parseSession(content);
          list.push(session);
        } catch {
          // Skip malformed log file
        }
      }
      list.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
      return list;
    },

    async append(session) {
      const targetPath = logPathForSession(session, logDir);
      const parentDir = path.dirname(targetPath);
      await fs.mkdir(parentDir, { recursive: true });
      const text = formatSession(session);
      await fs.writeFile(targetPath, text, "utf8");
      return path.basename(targetPath, ".txt");
    },

    async getActive() {
      try {
        const content = await fs.readFile(sessionPath, "utf8");
        return parseSession(content);
      } catch (err) {
        if (/** @type {any} */ (err).code === "ENOENT") {
          return null;
        }
        throw err;
      }
    },

    async setActive(session) {
      if (!session) {
        try {
          await fs.unlink(sessionPath);
        } catch (err) {
          if (/** @type {any} */ (err).code !== "ENOENT") {
            throw err;
          }
        }
        return;
      }
      const parentDir = path.dirname(sessionPath);
      await fs.mkdir(parentDir, { recursive: true });
      const text = formatSession(session);
      await fs.writeFile(sessionPath, text, "utf8");
    },
  };
}
