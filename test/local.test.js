// Local runtime end to end in a temp repo: CLI lifecycle commits, git hooks, data-only push.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repo = path.resolve(new URL("..", import.meta.url).pathname);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "swole-local-"));
const env = { ...process.env, SWOLE_SKIP_HOOK: "" };
const git = (...args) =>
  execFileSync("git", args, { cwd: dir, encoding: "utf8", env }).trim();
const swole = (...args) =>
  spawnSync(process.execPath, ["src/cli.js", ...args], {
    cwd: dir,
    encoding: "utf8",
    env,
  });
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const write = (f, t) => fs.writeFileSync(path.join(dir, f), t);
const events = () =>
  read("data/telemetry.jsonl")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

git("init", "-q", "-b", "main");
git("config", "user.email", "t@example.com");
git("config", "user.name", "t");
for (const p of ["src", "workline", "node_modules", ".githooks"])
  fs.symlinkSync(path.join(repo, p), path.join(dir, p));
write(".gitignore", "/src\n/workline\n/node_modules\n/.githooks\n");
fs.mkdirSync(path.join(dir, "data"));
write("data/routine.txt", "MONDAY\nDeadlift / 2x4+\n");
git("add", "-A");
git("commit", "-q", "-m", "init");

test("setup points git at .githooks", () => {
  assert.equal(swole("setup").status, 0);
  assert.equal(git("config", "core.hooksPath"), ".githooks");
});

test("start, stop and save commit the session and archive it", () => {
  const start = swole("start", "MONDAY");
  assert.equal(start.status, 0, start.stderr);
  assert.match(read("data/session.txt"), /^DAY: MONDAY\nSTART: /);
  assert.equal(git("log", "-1", "--format=%s"), "session: start monday");

  write(
    "data/session.txt",
    read("data/session.txt") + "Deadlift / 2x4 / 140kg\n",
  );
  const stop = swole("stop");
  assert.equal(stop.status, 0, stop.stderr);
  assert.match(read("data/session.txt"), /\nEND: /);
  assert.equal(git("log", "-1", "--format=%s"), "session: stop monday");

  const save = swole("save");
  assert.equal(save.status, 0, save.stderr);
  const id = save.stdout.match(/as (\d+)/)?.[1];
  assert.ok(id);
  assert.equal(fs.existsSync(path.join(dir, "data/session.txt")), false);
  const logs = git("ls-files", "data/log").split("\n");
  assert.equal(logs.length, 1);
  assert.match(logs[0], new RegExp(`^data/log/\\d{2}/\\d{2}/${id}\\.txt$`));
  assert.match(read(logs[0]), /Deadlift \/ 2x4 \/ 140kg/);
  assert.equal(git("log", "-1", "--format=%s"), `log: save session ${id}`);
  assert.equal(
    git("status", "--porcelain", "--", "data/log", "data/session.txt"),
    "",
  );

  const api = events()
    .filter((e) => e.category === "api")
    .map((e) => [e.action, e.data.ok]);
  assert.deepEqual(api, [
    ["start", true],
    ["stop", true],
    ["save", true],
  ]);
  const hooks = events()
    .filter((e) => e.category === "hook")
    .map((e) => e.action);
  assert.deepEqual(hooks, ["post-start", "post-stop", "post-save"]);
});

test("stop rejects an invalid line and leaves the session uncommitted", () => {
  assert.equal(swole("start", "MONDAY").status, 0);
  write("data/session.txt", read("data/session.txt") + "Deadlift / heavy\n");
  const stop = swole("stop");
  assert.equal(stop.status, 1);
  assert.match(stop.stderr, /session:1: /);
  assert.equal(git("log", "-1", "--format=%s"), "session: start monday");
  git("rm", "-q", "-f", "data/session.txt");
  git("commit", "-q", "-m", "discard", "--no-verify");
});

test("pre-commit blocks an invalid manual line", () => {
  write(
    "data/session.txt",
    "DAY: MONDAY\nSTART: 2026-11-16T18:00:00.000Z\n\nDeadlift / heavy\n",
  );
  git("add", "data/session.txt");
  const r = spawnSync("git", ["commit", "-q", "-m", "bad"], {
    cwd: dir,
    encoding: "utf8",
    env,
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /pre-commit: data\/session\.txt:4: /);
});

test("post-commit fires post-start for a manual session commit", () => {
  write(
    "data/session.txt",
    "DAY: MONDAY\nSTART: 2026-11-16T18:00:00.000Z\n\nDeadlift / 2x4 / 142.5kg\n",
  );
  git("add", "data/session.txt");
  git("commit", "-q", "-m", "manual start");
  const last = events().at(-1);
  assert.equal(last.action, "post-start");
  assert.equal(last.data.source, "git");
});

test("a data-only push skips check and tests", () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "swole-remote-"));
  execFileSync("git", ["init", "-q", "--bare", bare]);
  git("remote", "add", "origin", bare);
  git("push", "-q", "--no-verify", "-u", "origin", "main");
  git("add", "-A", "data");
  git("commit", "-q", "-m", "telemetry", "--allow-empty");
  const t0 = Date.now();
  const r = spawnSync("git", ["push", "-q"], {
    cwd: dir,
    encoding: "utf8",
    env,
  });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(Date.now() - t0 < 5000, "data-only push ran the test suite");
  assert.doesNotMatch(r.stdout + r.stderr, /npm run/);
});

test("serve exposes the api over http", async (t) => {
  const { spawn } = await import("node:child_process");
  const bare = git("remote", "get-url", "origin");
  git("config", "remote.origin.pushurl", bare);
  git(
    "remote",
    "set-url",
    "origin",
    "ssh://git@git.example.org:2222/o/swole.git",
  );
  const port = 4300 + Math.floor(Math.random() * 500);
  const srv = spawn(process.execPath, ["src/cli.js", "serve", String(port)], {
    cwd: dir,
    env,
  });
  t.after(() => srv.kill());
  await new Promise((ok) => srv.stdout.once("data", ok));
  const { client } = await import("../src/core/http.js");
  const api = client(`http://127.0.0.1:${port}`);
  const p = await api.load("MONDAY");
  assert.deepEqual(
    p.program.map((e) => [e.name, e.scheme, e.last]),
    [["Deadlift", "2x4+", "2x4 / 140kg"]],
  );
  assert.equal(
    p.navLinks.routine,
    "https://git.example.org/o/swole/src/branch/main/data/routine.txt",
  );
  await assert.rejects(
    api.save({
      day: "MONDAY",
      startAt: new Date().toISOString(),
      entries: [{ name: "Deadlift", load: "heavy" }],
    }),
    /session:1: /,
  );
  const r = await api.save({
    day: "MONDAY",
    startAt: new Date().toISOString(),
    entries: [{ name: "Deadlift", load: "2x4 / 145kg" }],
  });
  assert.equal(r.saved, 1);
  assert.equal(git("log", "-1", "--format=%s"), `log: save session ${r.id}`);
  assert.equal(
    execFileSync("git", ["-C", bare, "log", "-1", "--format=%s", "main"], {
      encoding: "utf8",
    }).trim(),
    `log: save session ${r.id}`,
    "save pushes when a remote is set",
  );
  assert.equal((await api.load("MONDAY")).program[0].last, "2x4 / 145kg");
});
