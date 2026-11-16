import {
  DAYS,
  resolveDay,
  key,
  validateSession,
  lastLoadsFromSessions,
} from "./model.js";
import { createHooks } from "./hooks.js";
import { createTelemetry } from "./telemetry.js";

/**
 * @typedef {import("../../types/swole.d.ts").Store} Store
 * @typedef {import("../../types/swole.d.ts").Session} Session
 * @typedef {import("../../types/swole.d.ts").ApiPayload} ApiPayload
 * @typedef {import("../../types/swole.d.ts").Api} Api
 */

/**
 * Creates the core Swole application service.
 *
 * @param {object} options Configuration options.
 * @param {Store} options.store Storage provider.
 * @param {ReturnType<typeof createHooks>} [options.hooks] Lifecycle hooks emitter.
 * @param {ReturnType<typeof createTelemetry>} [options.telemetry] Telemetry manager.
 * @param {{ routine?: string; log?: string }} [options.navLinks] Deep links for routine and log views.
 * @returns {Api} Service API instance.
 */
export function createService({
  store,
  hooks = createHooks(),
  telemetry = createTelemetry(),
  navLinks = {},
}) {
  /**
   * Wraps a service call to record its name, duration and outcome.
   *
   * @param {string} name Call name.
   * @param {(...a: any[]) => Promise<any>} fn Implementation.
   * @returns {(...a: any[]) => Promise<any>} Timed call.
   */
  const timed =
    (name, fn) =>
    async (...args) => {
      const t0 = Date.now();
      const done = (data) =>
        telemetry.track({
          category: "api",
          action: name,
          data: { ms: Date.now() - t0, ...data },
        });
      try {
        const out = await fn(...args);
        await done({ ok: true });
        return out;
      } catch (e) {
        await done({ ok: false, error: String(e?.message ?? e) });
        throw e;
      }
    };

  /**
   * Runs a lifecycle hook; a failing hook is reported, never thrown.
   *
   * @param {string} name Hook name.
   * @param {any} ctx Hook payload.
   * @returns {Promise<void>} Resolves after all handlers ran or one failed.
   */
  const fire = async (name, ctx) => {
    try {
      await hooks.emit(name, ctx);
      await telemetry.track({
        category: "hook",
        action: name,
        data: { ok: true },
      });
    } catch (e) {
      await telemetry.track({
        category: "hook",
        action: name,
        data: { ok: false, error: String(e?.message ?? e) },
      });
    }
  };

  /**
   * Stamps the end, drops entries without a load and validates.
   *
   * @param {Session} session Session from the client.
   * @returns {Session} Finished session.
   */
  const finish = (session) => {
    const out = {
      ...session,
      startAt: session.startAt && new Date(session.startAt),
      endAt: new Date(session.endAt || Date.now()),
      entries: (session.entries || []).filter((e) => e?.load?.trim()),
    };
    const { ok, errors } = validateSession(out);
    if (!ok) throw new Error(errors.join("; "));
    return out;
  };

  return {
    load: timed("load", async (day) => {
      const [routine, sessions, activeSession] = await Promise.all([
        store.routine(),
        store.sessions(),
        store.getActive ? store.getActive() : null,
      ]);

      const days = Object.keys(routine);
      const selectedDay = resolveDay(day);
      const effectiveDay = days.includes(selectedDay)
        ? selectedDay
        : days[0] || selectedDay;

      const lastLoads = lastLoadsFromSessions(sessions);
      const program = (routine[effectiveDay] || []).map((exercise) => ({
        ...exercise,
        last: lastLoads[key(exercise.name)] || "",
      }));

      return {
        day: effectiveDay,
        today: DAYS[(new Date().getDay() + 6) % 7],
        days: days.length > 0 ? days : [...DAYS],
        program,
        activeSession,
        navLinks,
      };
    }),

    start: timed("start", async (day) => {
      /** @type {Session} */
      const session = {
        day: resolveDay(day),
        startAt: new Date(),
        entries: [],
      };
      if (store.setActive) await store.setActive(session);
      await fire("post-start", session);
      return session;
    }),

    stop: timed("stop", async (session) => {
      const stopped = finish(session);
      if (store.setActive) await store.setActive(stopped);
      await fire("post-stop", stopped);
      return stopped;
    }),

    save: timed("save", async (session) => {
      const done = finish(session);
      const id = await store.append(done);
      if (store.setActive) await store.setActive(null);
      await fire("post-save", { session: done, id });
      return { ok: true, saved: done.entries.length, id };
    }),

    track: (event) => telemetry.track(event),
  };
}
