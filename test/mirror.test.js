// Mirror dry run into a local bare repo: no data/ in any commit, credentials refused.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const script = new URL("../scripts/mirror.sh", import.meta.url).pathname;
const hasFilterRepo =
  spawnSync("git", ["filter-repo", "--version"]).status === 0;
const env = { ...process.env, SWOLE_SKIP_HOOK: "1" };

/**
 * Creates a source repo with code, data/ history and a tag.
 *
 * @returns {{ src: string, git: (...a: string[]) => string }} Repo path and git runner.
 */
function source() {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), "swole-mirror-src-"));
  const git = (...a) =>
    execFileSync("git", a, { cwd: src, encoding: "utf8", env }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  fs.mkdirSync(path.join(src, "data/log"), { recursive: true });
  fs.writeFileSync(path.join(src, "app.js"), "1\n");
  fs.writeFileSync(path.join(src, "data/routine.txt"), "MONDAY\nSquat / 3x5\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  fs.writeFileSync(path.join(src, "data/log/1.txt"), "secret\n");
  git("add", "-A");
  git("commit", "-q", "-m", "log only");
  fs.writeFileSync(path.join(src, "app.js"), "2\n");
  git("commit", "-q", "-am", "code");
  git("tag", "v0.1.0");
  return { src, git };
}
const bare = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "swole-mirror-dst-"));
  execFileSync("git", ["init", "-q", "--bare", d]);
  return d;
};

test(
  "mirror pushes main and tags without data/",
  { skip: !hasFilterRepo && "git filter-repo missing" },
  () => {
    const { src } = source();
    const dst = bare();
    const r = spawnSync("bash", [script, src, dst], { encoding: "utf8", env });
    assert.equal(r.status, 0, r.stderr);
    const g = (...a) =>
      execFileSync("git", ["-C", dst, ...a], { encoding: "utf8" }).trim();
    assert.equal(
      g("log", "--all", "--format=", "--name-only")
        .split("\n")
        .filter((f) => f.startsWith("data/")).length,
      0,
    );
    assert.deepEqual(g("log", "--format=%s", "main").split("\n"), [
      "code",
      "init",
    ]);
    assert.equal(g("tag"), "v0.1.0");
    const again = spawnSync("bash", [script, src, dst], {
      encoding: "utf8",
      env,
    });
    assert.equal(
      again.status,
      0,
      `re-mirror is a fast-forward: ${again.stderr}`,
    );
  },
);

test(
  "mirror refuses a committed .clasprc.json",
  { skip: !hasFilterRepo && "git filter-repo missing" },
  () => {
    const { src, git } = source();
    fs.writeFileSync(path.join(src, ".clasprc.json"), "{}");
    git("add", "-f", ".clasprc.json");
    git("commit", "-q", "-m", "oops");
    const dst = bare();
    const r = spawnSync("bash", [script, src, dst], { encoding: "utf8", env });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /refusing to push, found:\n\.clasprc\.json/);
    assert.equal(
      execFileSync("git", ["-C", dst, "rev-list", "--all"], {
        encoding: "utf8",
      }).trim(),
      "",
    );
  },
);
