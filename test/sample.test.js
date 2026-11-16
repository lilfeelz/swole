import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { init, parseLine, serializeLine } from "../workline/index.js";
import { parseRoutine, parseSession, DAYS } from "../src/core/model.js";

await init();
const root = new URL("../sample/", import.meta.url).pathname;
const read = (f) => readFileSync(join(root, f), "utf8");
const logs = readdirSync(join(root, "log"), { recursive: true })
  .filter((f) => String(f).endsWith(".txt"))
  .map((f) => join("log", String(f)));

/**
 * Asserts a full line parses and is already canonical.
 *
 * @param {string} line Full workline.
 */
const canonical = (line) => assert.equal(serializeLine(parseLine(line)), line);

test("routine lines are canonical worklines", () => {
  const routine = parseRoutine(read("routine.txt"));
  assert.ok(
    Object.keys(routine).every((d) => DAYS.includes(/** @type {any} */ (d))),
  );
  for (const list of Object.values(routine))
    for (const ex of list) canonical(`${ex.name} / ${ex.scheme}`);
});

test("log lines are canonical worklines", () => {
  assert.ok(logs.length > 0);
  for (const f of logs)
    for (const e of parseSession(read(f)).entries)
      canonical(`${e.name} / ${e.load}`);
});
