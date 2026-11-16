import test from "node:test";
import assert from "node:assert/strict";
import { createService } from "../src/core/service.js";
import { createHooks } from "../src/core/hooks.js";
import { memorySink, createTelemetry } from "../src/core/telemetry.js";

/**
 * Creates an in-memory test store.
 */
function createMockStore() {
  let active = null;
  const routineData = {
    MONDAY: [
      { name: "Deadlift", scheme: "3x4-6" },
      { name: "Bench Press", scheme: "3x6-8" },
    ],
  };
  const sessionList = [
    {
      day: "MONDAY",
      startAt: new Date("2026-11-09T18:00:00Z"),
      endAt: new Date("2026-11-09T18:50:00Z"),
      entries: [
        { name: "Deadlift", load: "140kg x 5" },
        { name: "Bench Press", load: "90kg x 6" },
      ],
    },
  ];

  return {
    async routine() {
      return routineData;
    },
    async sessions() {
      return sessionList;
    },
    async append(session) {
      sessionList.push(session);
      return "1700000000";
    },
    async getActive() {
      return active;
    },
    async setActive(session) {
      active = session;
    },
    get active() {
      return active;
    },
  };
}

test("service.load populates exercises with historic last loads", async () => {
  const store = createMockStore();
  const service = createService({
    store,
    navLinks: { routine: "#routine", log: "#log" },
  });

  const payload = await service.load("MONDAY");
  assert.equal(payload.day, "MONDAY");
  assert.equal(payload.program.length, 2);
  assert.equal(payload.program[0].name, "Deadlift");
  assert.equal(payload.program[0].last, "140kg x 5");
  assert.equal(payload.program[1].name, "Bench Press");
  assert.equal(payload.program[1].last, "90kg x 6");
  assert.equal(payload.navLinks?.routine, "#routine");
  assert.equal(payload.navLinks?.log, "#log");
});

test("service session lifecycle: start, stop, save with hooks and telemetry", async () => {
  const store = createMockStore();
  const hooks = createHooks();
  const sink = memorySink();
  const telemetry = createTelemetry([sink]);

  const hookEvents = [];
  hooks.on("post-start", (s) => hookEvents.push(["start", s.day]));
  hooks.on("post-stop", (s) => hookEvents.push(["stop", s.day]));
  hooks.on("post-save", ({ session, id }) =>
    hookEvents.push(["save", session.day, id]),
  );

  const service = createService({ store, hooks, telemetry });

  // 1. Start
  const started = await service.start("MONDAY");
  assert.equal(started.day, "MONDAY");
  assert.ok(started.startAt instanceof Date);
  assert.deepEqual(store.active, started);

  // 2. Add entry and Stop
  started.entries.push({ name: "Deadlift", load: "142.5kg x 5" });
  const stopped = await service.stop(started);
  assert.ok(stopped.endAt instanceof Date);
  assert.deepEqual(store.active, stopped);

  // 3. Save
  const saveResult = await service.save(stopped);
  assert.equal(saveResult.ok, true);
  assert.equal(saveResult.saved, 1);
  assert.equal(saveResult.id, "1700000000");
  assert.equal(store.active, null);

  // Verify hook sequence
  assert.deepEqual(hookEvents, [
    ["start", "MONDAY"],
    ["stop", "MONDAY"],
    ["save", "MONDAY", "1700000000"],
  ]);

  // Verify telemetry events
  const actions = sink.events.map((e) => e.action);
  assert.deepEqual(actions, ["start", "stop", "save"]);
});
