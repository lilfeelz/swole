import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { testStoreContract } from "./store-contract.js";
import { createBrowserStore } from "../src/stores/browser.js";
import { createGitStore } from "../src/stores/git.js";
import { createSheetStore } from "../src/stores/sheet.js";
import { createKvStore } from "../src/stores/kv.js";

// 1. Browser Store
testStoreContract("BrowserStore", async () => {
  const map = new Map();
  const mockStorage = {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  return createBrowserStore({ storage: mockStorage });
});

// 2. Git Store
testStoreContract("GitStore", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "swole-test-"));
  const routineContent = `MONDAY\nSquat / 3x5\nBench Press / 3x5\n`;
  await fs.writeFile(path.join(tempDir, "routine.txt"), routineContent, "utf8");
  return createGitStore({ fs, dir: tempDir });
});

// 3. Sheet Store
/**
 * Fake Sheet with the calls SheetStore makes.
 *
 * @param {any[][]} rows Initial cell values.
 * @returns {any} Sheet.
 */
const fakeSheet = (rows) => ({
  rows,
  getLastRow: () => rows.length,
  getRange(a, c, nr, nc) {
    const [r0, c0, h, w] =
      typeof a === "string"
        ? [1, 1, Number(a.split(":B")[1]), 2]
        : [a, c, nr, nc];
    return {
      getValues: () =>
        Array.from({ length: h }, (_, i) =>
          Array.from(
            { length: w },
            (_, j) => rows[r0 - 1 + i]?.[c0 - 1 + j] ?? "",
          ),
        ),
      setValues: (vals) => vals.forEach((v, i) => (rows[r0 - 1 + i] = v)),
    };
  },
});

testStoreContract("SheetStore", async () => {
  const tabs = {
    routine: fakeSheet([["MONDAY"], ["Squat", "3x5"], ["Bench Press", "3x5"]]),
    log: fakeSheet([["Start", "End", "Day", "Exercise", "Load"]]),
  };
  return createSheetStore({
    spreadsheet: { getSheetByName: (n) => tabs[n] ?? null },
  });
});

test("SheetStore follows gswole sheet rules", async () => {
  const log = fakeSheet([["Start", "End", "Day", "Exercise", "Load"]]);
  const tabs = {
    "ad infinitum": fakeSheet([
      ["MONDAY - Push"],
      ["Bench Press", "3x6+"],
      ["Bike", "20m"],
      ["bench press", "dup"],
      [""],
      ["Thursday"],
      ["Squat", "3x5"],
    ]),
    log,
  };
  const store = createSheetStore({
    spreadsheet: { getSheetByName: (n) => tabs[n] ?? null },
  });
  assert.deepEqual(await store.routine(), {
    MONDAY: [{ name: "Bench Press", scheme: "3x6+" }],
    THURSDAY: [{ name: "Squat", scheme: "3x5" }],
  });
  const startAt = new Date("2026-11-16T23:30:00Z");
  await store.append({
    day: "MONDAY",
    startAt,
    endAt: new Date("2026-11-16T00:20:00Z"),
    entries: [
      { name: "Bench Press", load: "3x6 / 90kg" },
      { name: "Squat", load: "1x5" },
    ],
  });
  assert.equal(log.rows.length, 3);
  assert.deepEqual(log.rows[1].slice(2), [
    "MONDAY",
    "Bench Press",
    "3x6 / 90kg",
  ]);
  assert.equal(log.rows[1][1].toISOString(), "2026-11-17T00:20:00.000Z");
  const [s] = await store.sessions();
  assert.equal(s.entries.length, 2);
});

// 4. KV Store
testStoreContract("KvStore", async () => {
  const kvData = new Map();
  kvData.set(
    "routine",
    JSON.stringify({
      MONDAY: [
        { name: "Squat", scheme: "3x5" },
        { name: "Bench Press", scheme: "3x5" },
      ],
    }),
  );

  const mockKv = {
    async get(key, type) {
      const val = kvData.get(key);
      if (val === undefined) return null;
      if (type === "json") {
        try {
          return JSON.parse(val);
        } catch {
          return null;
        }
      }
      return val;
    },
    async put(key, val) {
      kvData.set(key, String(val));
    },
    async delete(key) {
      kvData.delete(key);
    },
  };

  return createKvStore({ kv: mockKv });
});
