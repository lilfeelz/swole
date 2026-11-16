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
  return {
    async load(day) {
      const [routine, sessions, activeSession] = await Promise.all([
        store.routine(),
        store.sessions(),
        store.getActive ? store.getActive() : Promise.resolve(null),
      ]);

      const days = Object.keys(routine);
      const selectedDay = resolveDay(day);
      const todayWeekday = DAYS[(new Date().getDay() + 6) % 7];
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
        today: todayWeekday,
        days: days.length > 0 ? days : [...DAYS],
        program,
        activeSession,
        navLinks,
      };
    },

    async start(day) {
      const selectedDay = resolveDay(day);
      /** @type {Session} */
      const session = {
        day: selectedDay,
        startAt: new Date(),
        entries: [],
      };

      if (store.setActive) {
        await store.setActive(session);
      }

      await hooks.emit("post-start", session);
      await telemetry.track({
        category: "session",
        action: "start",
        label: selectedDay,
        data: { startAt: session.startAt.toISOString() },
      });

      return session;
    },

    async stop(session) {
      const stopped = {
        ...session,
        endAt: session.endAt || new Date(),
      };

      if (store.setActive) {
        await store.setActive(stopped);
      }

      await hooks.emit("post-stop", stopped);
      await telemetry.track({
        category: "session",
        action: "stop",
        label: stopped.day,
        data: {
          startAt: stopped.startAt ? stopped.startAt.toISOString() : undefined,
          endAt: stopped.endAt.toISOString(),
          durationMs:
            stopped.startAt instanceof Date
              ? stopped.endAt.getTime() - stopped.startAt.getTime()
              : 0,
        },
      });

      return stopped;
    },

    async save(session) {
      validateSession(session);
      const completed = {
        ...session,
        endAt: session.endAt || new Date(),
      };

      const id = await store.append(completed);

      if (store.setActive) {
        await store.setActive(null);
      }

      await hooks.emit("post-save", { session: completed, id });
      await telemetry.track({
        category: "session",
        action: "save",
        label: completed.day,
        data: {
          id,
          count: completed.entries.length,
        },
      });

      return {
        ok: true,
        saved: completed.entries.length,
        id,
      };
    },

    async track(event) {
      await telemetry.track(event);
    },
  };
}
