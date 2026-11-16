#!/usr/bin/env node
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createGitStore } from "./stores/git.js";
import { createService } from "./core/service.js";
import { createTelemetry, consoleSink, jsonlSink } from "./core/telemetry.js";
import { handler } from "./core/http.js";
import { DAYS, key, parseSession, validateSession } from "./core/model.js";
import { ready } from "./workline.js";
import { parseLine } from "../workline/index.js";

const root = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return process.cwd();
  }
})();
const data = path.join(root, "data");
const git = (args, env = {}) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  }).trimEnd();
const telemetry = createTelemetry([
  consoleSink(),
  jsonlSink(path.join(data, "telemetry.jsonl"), fs),
]);

/**
 * Checks every exercise line of a routine, session or log file against workline.
 *
 * @param {string} file Name used in messages.
 * @param {string} text File contents.
 * @returns {string[]} One "file:line: reason" per bad line.
 */
function lint(file, text) {
  const errs = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#") || /^(DAY|START|END):/i.test(line))
      return;
    if (DAYS.includes(/** @type {any} */ (line.toUpperCase()))) return;
    try {
      if (!parseLine(line).name) throw new Error("missing exercise name");
    } catch (e) {
      errs.push(`${file}:${i + 1}: ${e.message}`);
    }
  });
  return errs;
}

/**
 * Throws when a session's entries are not valid worklines.
 *
 * @param {import("../types/swole.d.ts").Session} s Session to check.
 */
const assertEntries = (s) => {
  const errs = lint(
    "session",
    (s.entries || [])
      .filter((e) => e.load?.trim())
      .map((e) => `${e.name} / ${e.load}`)
      .join("\n"),
  );
  if (errs.length) throw new Error(errs.join("; "));
};

/**
 * Forgejo links for the Routine and Log tabs, derived from the origin remote.
 *
 * @returns {{ routine?: string, log?: string }} Links, empty without a parsable origin.
 */
function navLinks() {
  try {
    const url = git(["remote", "get-url", "origin"]);
    const m = url.match(
      /^(?:https?:\/\/|ssh:\/\/)?(?:[^@/]+@)?([^:/]+)(?::\d+)?[:/](.+?)(?:\.git)?$/,
    );
    if (!m) return {};
    const base = `https://${m[1]}/${m[2]}/src/branch/${git(["branch", "--show-current"])}/data`;
    return { routine: `${base}/routine.txt`, log: `${base}/log` };
  } catch {
    return {};
  }
}

/**
 * Service over data/, committing each change; hooks fire from the service, so git hooks skip these commits.
 *
 * @returns {import("../types/swole.d.ts").Api} Local service.
 */
const service = () => {
  const api = createService({
    store: createGitStore({
      fs,
      dir: data,
      commit: async (message) => {
        git(["add", "-A", "--", "data"]);
        if (
          spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: root })
            .status
        )
          git(["commit", "-q", "-m", message], { SWOLE_SKIP_HOOK: "1" });
      },
      push: async () => {
        if (git(["remote"])) git(["push", "-q"]);
      },
    }),
    telemetry,
    navLinks: navLinks(),
  });
  return {
    ...api,
    stop: async (s) => (assertEntries(s), api.stop(s)),
    save: async (s) => (assertEntries(s), api.save(s)),
  };
};

/**
 * Reads data/session.txt or fails.
 *
 * @returns {Promise<import("../types/swole.d.ts").Session>} Active session.
 */
async function active() {
  const file = path.join(data, "session.txt");
  const text = await fs.readFile(file, "utf8").catch(() => {
    throw new Error("no data/session.txt; run start first");
  });
  return parseSession(text);
}

/**
 * Serves the local UI bundle and the api on one port.
 *
 * @param {number} port Port.
 * @param {string} host Bind address.
 */
function serve(port, host) {
  const dist = path.join(root, "dist", "local");
  const api = handler(service());
  const types = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
  };
  http
    .createServer(async (req, res) => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const url = `http://${req.headers.host}${req.url}`;
      const out = await api(
        new Request(url, {
          method: req.method,
          headers: { "Content-Type": "application/json" },
          body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
        }),
      );
      if (out) {
        res.writeHead(out.status, { "Content-Type": "application/json" });
        return res.end(await out.text());
      }
      const name = new URL(url).pathname.replace(/^\/$/, "/index.html");
      const file = path.join(dist, path.normalize(name));
      try {
        if (!file.startsWith(dist + path.sep)) throw new Error("outside dist");
        const body = await fs.readFile(file);
        res.writeHead(200, {
          "Content-Type": types[path.extname(file)] || "text/plain",
        });
        res.end(body);
      } catch {
        res.writeHead(404).end("not found");
      }
    })
    .listen(port, host, () =>
      console.log(`swole at http://${host}:${port} (run npm run build first)`),
    );
}

/**
 * Prints session counts, average duration and top exercises from data/log.
 *
 * @returns {Promise<void>} Resolves when printed.
 */
async function stats() {
  const sessions = await createGitStore({ fs, dir: data }).sessions();
  const byDay = {};
  const ex = {};
  const mins = [];
  for (const s of sessions) {
    byDay[s.day] = (byDay[s.day] || 0) + 1;
    const ms =
      s.endAt && s.startAt ? s.endAt.getTime() - s.startAt.getTime() : 0;
    if (ms > 0 && ms < 864e5) mins.push(ms / 6e4);
    for (const e of s.entries) {
      const k = (ex[key(e.name)] ||= { name: e.name, count: 0, last: "" });
      k.count++;
      k.last = e.load || k.last;
    }
  }
  const avg = mins.length
    ? Math.round(mins.reduce((a, b) => a + b) / mins.length)
    : 0;
  console.log(`Total sessions: ${sessions.length}`);
  console.log(`Average duration: ${avg} min`);
  console.log(`Sessions by day: ${JSON.stringify(byDay)}`);
  for (const e of Object.values(ex)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5))
    console.log(
      `  - ${e.name}: ${e.count} sessions (last: ${e.last || "none"})`,
    );
}

/**
 * pre-commit: validates staged data/ text files.
 *
 * @returns {number} Exit code.
 */
function preCommit() {
  const files = git([
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACMR",
    "--",
    "data",
  ])
    .split("\n")
    .filter((f) => f.endsWith(".txt"));
  const errs = [];
  for (const f of files) {
    const text = git(["show", `:${f}`]);
    errs.push(...lint(f, text));
    if (f !== "data/routine.txt") {
      const v = validateSession(parseSession(text));
      errs.push(...v.errors.map((e) => `${f}: ${e}`));
    }
  }
  for (const e of errs) console.error(`pre-commit: ${e}`);
  return errs.length ? 1 : 0;
}

/**
 * post-commit: fires the lifecycle event a manual commit made.
 *
 * @returns {Promise<number>} Exit code.
 */
async function postCommit() {
  const changes = git([
    "diff-tree",
    "--no-commit-id",
    "--name-status",
    "--no-renames",
    "-r",
    "--root",
    "HEAD",
  ])
    .split("\n")
    .map((l) => l.split("\t"));
  const log = changes.find(
    ([s, f]) => s === "A" && /^data\/log\/.+\.txt$/.test(f),
  );
  const sess = changes.find(([, f]) => f === "data/session.txt");
  const [event, file] = log
    ? ["post-save", log[1]]
    : sess?.[0] === "A"
      ? ["post-start", sess[1]]
      : sess?.[0] === "M"
        ? ["post-stop", sess[1]]
        : [];
  if (!event) return 0;
  const s = parseSession(git(["show", `HEAD:${file}`]));
  if (event === "post-stop" && !s.endAt) return 0;
  await telemetry.track({
    category: "hook",
    action: event,
    label: s.day,
    data: { ok: true, source: "git", id: path.basename(file, ".txt") },
  });
  return 0;
}

/**
 * pre-push: Forgejo has no CI, so a push carrying code runs check and tests; data-only pushes pass.
 *
 * @param {string} stdin Ref lines from git.
 * @returns {number} Exit code.
 */
function prePush(stdin) {
  const zero = /^0+$/;
  const code = stdin
    .split("\n")
    .map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length === 4 && !zero.test(p[1]))
    .some(([, local, , remote]) =>
      git(
        zero.test(remote)
          ? ["log", "--name-only", "--format=", local, "--not", "--remotes"]
          : ["diff", "--name-only", `${remote}..${local}`],
      )
        .split("\n")
        .some((f) => f && !f.startsWith("data/")),
    );
  if (!code) return 0;
  for (const script of ["check", "test"]) {
    const r = spawnSync("npm", ["run", script], {
      cwd: root,
      stdio: "inherit",
    });
    if (r.status !== 0) return r.status || 1;
  }
  return 0;
}

const usage =
  "usage: swole <start [DAY]|stop|save|serve [PORT] [HOST]|setup|validate|stats|hook <pre-commit|post-commit|pre-push>>";

/**
 * CLI entry.
 *
 * @param {string[]} argv Arguments after the script.
 * @returns {Promise<number>} Exit code.
 */
async function main([cmd, ...args]) {
  await ready;
  if (cmd === "start") {
    const s = await service().start(args[0]);
    console.log(`started ${s.day}: data/session.txt`);
  } else if (cmd === "stop") {
    await service().stop(await active());
    console.log("stopped: data/session.txt");
  } else if (cmd === "save") {
    const { id, saved } = await service().save(await active());
    console.log(`saved ${saved} exercises as ${id}`);
  } else if (cmd === "serve")
    serve(Number(args[0]) || 4173, args[1] || "127.0.0.1");
  else if (cmd === "setup") {
    git(["config", "core.hooksPath", ".githooks"]);
    console.log("core.hooksPath=.githooks");
  } else if (cmd === "validate") {
    const files = ["routine.txt", "session.txt"].map((f) => path.join(data, f));
    const logDir = path.join(data, "log");
    for (const f of await fs
      .readdir(logDir, { recursive: true })
      .catch(() => []))
      if (f.endsWith(".txt")) files.push(path.join(logDir, f));
    const errs = [];
    for (const f of files) {
      const text = await fs.readFile(f, "utf8").catch(() => null);
      if (text !== null) errs.push(...lint(path.relative(root, f), text));
    }
    for (const e of errs) console.error(e);
    if (errs.length) return 1;
    console.log("ok");
  } else if (cmd === "stats") await stats();
  else if (cmd === "hook" && args[0] === "pre-commit") return preCommit();
  else if (cmd === "hook" && args[0] === "post-commit") return postCommit();
  else if (cmd === "hook" && args[0] === "pre-push")
    return prePush(readFileSync(0, "utf8"));
  else {
    console.error(usage);
    return 1;
  }
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => (process.exitCode = code),
  (e) => {
    console.error(e?.message ?? e);
    process.exitCode = 1;
  },
);
