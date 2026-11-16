// Apps Script output: one self-contained Index.html, and a Code.js whose globals work on a fake Sheet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import vm from "node:vm";

const dist = new URL("../dist/gas/", import.meta.url);
execFileSync(process.execPath, ["scripts/build.js"], {
  cwd: new URL("..", import.meta.url),
  stdio: "ignore",
});

test("Index.html references no external script, style or wasm", () => {
  const html = fs.readFileSync(new URL("Index.html", dist), "utf8");
  assert.equal(html.match(/<script/g)?.length, 1);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+stylesheet/);
  assert.match(html, /WORKLINE|AGFzbQ/, "wasm is inlined as base64");
  assert.doesNotMatch(html, /<\?/, "no template scriptlets");
  console.log(`Index.html: ${(html.length / 1024).toFixed(0)} KB`);
});

test("Code.js globals load and save through the Sheet", async () => {
  const rows = {
    routine: [["MONDAY"], ["Squat", "3x5"]],
    log: [["Start", "End", "Day", "Exercise", "Load"]],
  };
  const sheet = (name) => ({
    getSheetId: () => (name === "log" ? 7 : 3),
    getLastRow: () => rows[name].length,
    getRange(a, c, nr, nc) {
      const [r0, c0, h, w] =
        typeof a === "string" ? [1, 1, 200, 2] : [a, c, nr, nc];
      return {
        getValues: () =>
          Array.from({ length: h }, (_, i) =>
            Array.from(
              { length: w },
              (_, j) => rows[name][r0 - 1 + i]?.[c0 - 1 + j] ?? "",
            ),
          ),
        setValues: (v) => v.forEach((r, i) => (rows[name][r0 - 1 + i] = r)),
      };
    },
  });
  const ctx = vm.createContext({
    console: { log() {}, error() {} },
    SpreadsheetApp: {
      getActive: () => ({
        getUrl: () => "https://sheet",
        getSheetByName: (n) => (rows[n] ? sheet(n) : null),
      }),
    },
  });
  vm.runInContext(fs.readFileSync(new URL("Code.js", dist), "utf8"), ctx);
  const p = await ctx.apiLoad("MONDAY");
  assert.equal(p.program[0].name, "Squat");
  assert.equal(p.navLinks.routine, "https://sheet#gid=3");
  assert.equal(p.navLinks.log, "https://sheet#gid=7");
  const r = await ctx.apiSave({
    day: "MONDAY",
    startAt: "2026-11-16T18:00:00.000Z",
    endAt: "2026-11-16T19:00:00.000Z",
    entries: [{ name: "Squat", load: "3x5 / 100kg" }],
  });
  assert.equal(r.saved, 1);
  assert.equal(typeof r.id, "string");
  assert.equal(rows.log[1][4], "3x5 / 100kg");
  assert.equal((await ctx.apiLoad("MONDAY")).program[0].last, "3x5 / 100kg");
});
