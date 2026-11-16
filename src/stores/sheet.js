import { DAYS, CARDIO } from "../core/model.js";

/**
 * @typedef {import("../../types/swole.d.ts").Store} Store
 * @typedef {import("../../types/swole.d.ts").Session} Session
 * @typedef {import("../../types/swole.d.ts").Routine} Routine
 */

/**
 * Creates a Google Sheets-backed store for Google Apps Script.
 *
 * @param {object} options Configuration options.
 * @param {any} options.spreadsheet Spreadsheet object (SpreadsheetApp instance or mock).
 * @param {string} [options.routineTab] Name of routine tab.
 * @param {string} [options.logTab] Name of log tab.
 * @returns {Store} Sheet store instance.
 */
export function createSheetStore({
  spreadsheet,
  routineTab = "routine",
  logTab = "log",
}) {
  return {
    async routine() {
      const sheet = spreadsheet.getSheetByName(routineTab);
      if (!sheet) return {};

      const values = sheet.getDataRange().getValues();
      /** @type {Record<string, Array<{ name: string, scheme: string }>>} */
      const routine = {};
      let currentDay = "";

      for (const row of values) {
        const col0 = String(row[0] || "").trim();
        const col1 = String(row[1] || "").trim();
        if (!col0 && !col1) continue;

        const upper = col0.toUpperCase();
        if (DAYS.includes(/** @type {any} */ (upper))) {
          currentDay = upper;
          if (!routine[currentDay]) routine[currentDay] = [];
          continue;
        }

        if (currentDay && col0 && !CARDIO.test(col0)) {
          routine[currentDay].push({
            name: col0,
            scheme: col1,
          });
        }
      }

      return routine;
    },

    async sessions() {
      const sheet = spreadsheet.getSheetByName(logTab);
      if (!sheet) return [];

      const values = sheet.getDataRange().getValues();
      if (!values || values.length === 0) return [];

      // Skip header row if first cell is "startAt" or similar
      let startIndex = 0;
      if (
        String(values[0][0] || "")
          .toLowerCase()
          .includes("start")
      ) {
        startIndex = 1;
      }

      /** @type {Map<string, Session>} */
      const sessionMap = new Map();

      for (let i = startIndex; i < values.length; i++) {
        const row = values[i];
        const rawStart = row[0];
        const rawEnd = row[1];
        const day = String(row[2] || "").trim();
        const name = String(row[3] || "").trim();
        const load = String(row[4] || "").trim();

        if (!rawStart || !day || !name) continue;

        const startAt =
          rawStart instanceof Date ? rawStart : new Date(rawStart);
        const endAt = rawEnd
          ? rawEnd instanceof Date
            ? rawEnd
            : new Date(rawEnd)
          : undefined;

        const key = `${startAt.toISOString()}_${day}`;
        let session = sessionMap.get(key);
        if (!session) {
          session = {
            day,
            startAt,
            endAt,
            entries: [],
          };
          sessionMap.set(key, session);
        }

        session.entries.push({ name, load });
      }

      const list = Array.from(sessionMap.values());
      list.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
      return list;
    },

    async append(session) {
      const sheet = spreadsheet.getSheetByName(logTab);
      if (!sheet) {
        throw new Error(`Sheet tab "${logTab}" not found`);
      }

      const rows = session.entries.map((entry) => [
        session.startAt instanceof Date
          ? session.startAt.toISOString()
          : session.startAt,
        session.endAt instanceof Date
          ? session.endAt.toISOString()
          : session.endAt || "",
        session.day,
        entry.name,
        entry.load,
      ]);

      if (rows.length > 0) {
        for (const row of rows) {
          sheet.appendRow(row);
        }
      }

      return String(session.endAt ? session.endAt.getTime() : Date.now());
    },
  };
}
