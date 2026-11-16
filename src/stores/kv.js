/**
 * @typedef {import("../../types/swole.d.ts").Store} Store
 * @typedef {import("../../types/swole.d.ts").Session} Session
 * @typedef {import("../../types/swole.d.ts").Routine} Routine
 */

/**
 * Creates a Cloudflare Workers KV-backed store.
 *
 * @param {object} options Configuration options.
 * @param {any} options.kv Cloudflare KV namespace binding.
 * @returns {Store} KV store instance.
 */
export function createKvStore({ kv }) {
  return {
    async routine() {
      const data = await kv.get("routine", "json");
      return data || {};
    },

    async sessions() {
      const keys = (await kv.get("index:sessions", "json")) || [];
      if (!Array.isArray(keys) || keys.length === 0) return [];

      const sessions = await Promise.all(
        keys.map(async (k) => {
          const item = await kv.get(k, "json");
          if (!item) return null;
          return {
            ...item,
            startAt: new Date(item.startAt),
            endAt: item.endAt ? new Date(item.endAt) : undefined,
          };
        }),
      );

      /** @type {Session[]} */
      const valid = sessions.filter((s) => s !== null);
      valid.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
      return valid;
    },

    async append(session) {
      // Same id as the git log file: start time in unix seconds, bumped on a clash.
      let n = Math.floor(new Date(session.startAt).getTime() / 1000);
      while (await kv.get(`log:${n}`)) n++;
      const id = String(n);
      const key = `log:${id}`;
      const serialized = {
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
      };

      await kv.put(key, JSON.stringify(serialized));

      const keys = (await kv.get("index:sessions", "json")) || [];
      if (!keys.includes(key)) {
        keys.push(key);
        await kv.put("index:sessions", JSON.stringify(keys));
      }

      return id;
    },

    async getActive() {
      const item = await kv.get("session:active", "json");
      if (!item) return null;
      return {
        ...item,
        startAt: new Date(item.startAt),
        endAt: item.endAt ? new Date(item.endAt) : undefined,
      };
    },

    async setActive(session) {
      if (!session) {
        await kv.delete("session:active");
        return;
      }
      const serialized = {
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
      };
      await kv.put("session:active", JSON.stringify(serialized));
    },
  };
}
