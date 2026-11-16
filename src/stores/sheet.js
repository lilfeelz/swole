import { DAYS, CARDIO, key } from "../core/model.js";

/**
 * @typedef {import("../../types/swole.d.ts").Store} Store
 * @typedef {import("../../types/swole.d.ts").Session} Session
 */

/**
 * Creates the Google Sheet store over the gswole spreadsheet: `routine` and `log` tabs only.
 *
 * @param {object} options Configuration options.
 * @param {any} options.spreadsheet SpreadsheetApp spreadsheet, or a fake in tests.
 * @returns {Store} Sheet store instance.
 */
export function createSheetStore({ spreadsheet }) {
  const tab = (...names) =>
    names.map((n) => spreadsheet.getSheetByName(n)).find(Boolean) || null;
  const log = () => {
    const sh = tab("log");
    if (!sh) throw new Error("missing log tab");
    return sh;
  };

  return {
    async routine() {
      const sh = tab("routine", "ad infinitum", "ad infinitium");
      if (!sh) return {};
      /** @type {import("../../types/swole.d.ts").Routine} */
      const out = {};
      let day = "";
      const seen = new Set();
      for (const [a, b] of sh.getRange("A1:B200").getValues()) {
        const name = String(a || "").trim();
        if (!name) continue;
        const head = name.toUpperCase().split(/[^A-Z]+/)[0];
        if (DAYS.includes(/** @type {any} */ (head))) {
          day = head;
          out[day] ||= [];
          seen.clear();
          continue;
        }
        if (!day || CARDIO.test(name) || seen.has(key(name))) continue;
        seen.add(key(name));
        out[day].push({ name, scheme: String(b || "").trim() });
      }
      return out;
    },

    async sessions() {
      const sh = log();
      const last = sh.getLastRow();
      if (last < 2) return [];
      const byStart = new Map();
      for (const [start, end, day, name, load] of sh
        .getRange(2, 1, last - 1, 5)
        .getValues()) {
        const n = String(name || "").trim();
        if (!start || !n) continue;
        const startAt = new Date(start);
        const k = `${startAt.getTime()}|${day}`;
        if (!byStart.has(k))
          byStart.set(k, {
            day: String(day),
            startAt,
            endAt: end ? new Date(end) : undefined,
            entries: [],
          });
        byStart
          .get(k)
          .entries.push({ name: n, load: String(load ?? "").trim() });
      }
      return [...byStart.values()].sort(
        (a, b) => a.startAt.getTime() - b.startAt.getTime(),
      );
    },

    async append(session) {
      const sh = log();
      const startAt = new Date(session.startAt);
      let endAt = new Date(session.endAt || Date.now());
      // As in gswole: an end not after the start means the session ran past midnight.
      if (endAt <= startAt) endAt = new Date(endAt.getTime() + 864e5);
      const rows = session.entries.map((e) => [
        startAt,
        endAt,
        session.day,
        e.name,
        e.load,
      ]);
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
      return String(Math.floor(startAt.getTime() / 1000));
    },
  };
}
