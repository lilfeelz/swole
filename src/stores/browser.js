import { parseRoutine } from "../core/model.js";

/**
 * @typedef {import("../../types/swole.d.ts").Store} Store
 * @typedef {import("../../types/swole.d.ts").Session} Session
 * @typedef {import("../../types/swole.d.ts").Routine} Routine
 */

const DEFAULT_ROUTINE = `MONDAY
Deadlift | 3x4-6
Bench Press | 3x6-8
Pull-Up | 3x6-8

THURSDAY
Squat | 3x4-6
Overhead Press | 3x6-8
Barbell Row | 3x6-8`;

/**
 * Creates a browser localStorage store for demo and offline use.
 *
 * @param {object} [options] Configuration options.
 * @param {Storage | { getItem: (k: string) => string | null, setItem: (k: string, v: string) => void, removeItem: (k: string) => void }} [options.storage] Storage backend.
 * @param {string} [options.prefix] Key prefix.
 * @param {string} [options.initialRoutine] Initial routine text seed.
 * @returns {Store} Browser store instance.
 */
export function createBrowserStore({
  storage = typeof localStorage !== "undefined"
    ? localStorage
    : /** @type {any} */ (null),
  prefix = "swole:",
  initialRoutine = DEFAULT_ROUTINE,
} = {}) {
  // In-memory fallback if storage is unavailable
  const mem = new Map();
  const backend = storage || {
    getItem: (k) => mem.get(k) || null,
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };

  return {
    async routine() {
      const saved = backend.getItem(`${prefix}routine`);
      return parseRoutine(saved || initialRoutine);
    },

    async sessions() {
      const raw = backend.getItem(`${prefix}sessions`);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((item) => ({
          ...item,
          startAt: new Date(item.startAt),
          endAt: item.endAt ? new Date(item.endAt) : undefined,
        }));
      } catch {
        return [];
      }
    },

    async append(session) {
      const current = await this.sessions();
      const id = String(session.endAt ? session.endAt.getTime() : Date.now());
      current.push(session);
      backend.setItem(
        `${prefix}sessions`,
        JSON.stringify(
          current.map((s) => ({
            day: s.day,
            startAt:
              s.startAt instanceof Date ? s.startAt.toISOString() : s.startAt,
            endAt: s.endAt instanceof Date ? s.endAt.toISOString() : s.endAt,
            entries: s.entries,
          })),
        ),
      );
      return id;
    },

    async getActive() {
      const raw = backend.getItem(`${prefix}active`);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        return {
          ...parsed,
          startAt: new Date(parsed.startAt),
          endAt: parsed.endAt ? new Date(parsed.endAt) : undefined,
        };
      } catch {
        return null;
      }
    },

    async setActive(session) {
      if (!session) {
        backend.removeItem(`${prefix}active`);
        return;
      }
      backend.setItem(
        `${prefix}active`,
        JSON.stringify({
          day: session.day,
          startAt:
            session.startAt instanceof Date
              ? session.startAt.toISOString()
              : session.startAt,
          endAt:
            session.endAt instanceof Date
              ? session.endAt.toISOString()
              : session.endAt,
          entries: session.entries,
        }),
      );
    },
  };
}
