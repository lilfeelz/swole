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
testStoreContract("SheetStore", async () => {
  const routineRows = [
    ["MONDAY", ""],
    ["Squat", "3x5"],
    ["Bench Press", "3x5"],
  ];
  const logRows = [["startAt", "endAt", "day", "name", "load"]];

  const mockSpreadsheet = {
    getSheetByName(name) {
      if (name === "routine") {
        return {
          getDataRange() {
            return {
              getValues() {
                return routineRows;
              },
            };
          },
        };
      }
      if (name === "log") {
        return {
          getDataRange() {
            return {
              getValues() {
                return logRows;
              },
            };
          },
          appendRow(row) {
            logRows.push(row);
          },
        };
      }
      return null;
    },
  };

  return createSheetStore({ spreadsheet: mockSpreadsheet });
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
