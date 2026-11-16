import test from "node:test";
import assert from "node:assert/strict";
import { createService } from "../src/core/service.js";
import { createHooks } from "../src/core/hooks.js";
import { memorySink, createTelemetry } from "../src/core/telemetry.js";
import { testStoreContract } from "./store-contract.js";

/**
 * Creates an in-memory store seeded with one Monday session.
 *
 * @returns {import("../types/swole.d.ts").Store & { active: any, list: any[] }} Store.
 */
function memoryStore() {
  let active = null;
  const list = [
    {
      day: "MONDAY",
      startAt: new Date("2026-11-09T18:00:00Z"),
      endAt: new Date("2026-11-09T18:50:00Z"),
      entries: [
        { name: "Deadlift", load: "2x5 / 140kg" },
        { name: "Bench Press", load: "3x6 / 90kg" },
      ],
    },
  ];
  return {
    list,
    routine: async () => ({
      MONDAY: [
        { name: "Deadlift", scheme: "3x4-6" },
        { name: "Bench Press", scheme: "3x6-8" },
      ],
    }),
    sessions: async () => [...list],
    append: async (s) => (list.push(s), String(list.length)),
    getActive: async () => active,
    setActive: async (s) => void (active = s),
    get active() {
      return active;
    },
  };
}

testStoreContract("MemoryStore", async () => {
  const s = memoryStore();
  s.list.length = 0;
  return s;
});

test("load fills last loads and nav links", async () => {
  const service = createService({
    store: memoryStore(),
    navLinks: { routine: "#routine", log: "#log" },
  });
  const p = await service.load("MONDAY");
  assert.equal(p.day, "MONDAY");
  assert.deepEqual(
    p.program.map((e) => [e.name, e.last]),
    [
      ["Deadlift", "2x5 / 140kg"],
      ["Bench Press", "3x6 / 90kg"],
    ],
  );
  assert.equal(p.navLinks?.routine, "#routine");
});

test("lifecycle fires post-start, post-stop, post-save in order and times each call", async () => {
  const store = memoryStore();
  const hooks = createHooks();
  const sink = memorySink();
  const seen = [];
  for (const h of ["post-start", "post-stop", "post-save"])
    hooks.on(h, () => seen.push(h));
  const service = createService({
    store,
    hooks,
    telemetry: createTelemetry([sink]),
  });

  const started = await service.start("MONDAY");
  assert.deepEqual(store.active, started);
  started.entries.push(
    { name: "Deadlift", load: "2x5 / 142.5kg" },
    { name: "Bench Press", load: " " },
  );
  const stopped = await service.stop(started);
  assert.ok(stopped.endAt instanceof Date);
  const res = await service.save(stopped);

  assert.deepEqual(res, { ok: true, saved: 1, id: "2" });
  assert.equal(store.active, null);
  assert.deepEqual(store.list[1].entries, [
    { name: "Deadlift", load: "2x5 / 142.5kg" },
  ]);
  assert.deepEqual(seen, ["post-start", "post-stop", "post-save"]);
  const api = sink.events.filter((e) => e.category === "api");
  assert.deepEqual(
    api.map((e) => [e.action, e.data.ok, typeof e.data.ms]),
    [
      ["start", true, "number"],
      ["stop", true, "number"],
      ["save", true, "number"],
    ],
  );
});

test("a failing hook is reported and never loses the saved session", async () => {
  const store = memoryStore();
  const hooks = createHooks();
  const sink = memorySink();
  hooks.on("post-save", () => {
    throw new Error("push failed");
  });
  const service = createService({
    store,
    hooks,
    telemetry: createTelemetry([sink]),
  });
  const res = await service.save({
    day: "MONDAY",
    startAt: new Date(),
    entries: [{ name: "Deadlift", load: "1x5 / 100kg" }],
  });
  assert.equal(res.ok, true);
  assert.equal(store.list.length, 2);
  const hook = sink.events.find((e) => e.category === "hook");
  assert.deepEqual(hook?.data, { ok: false, error: "push failed" });
});

test("save rejects an invalid session, stores nothing and reports the error", async () => {
  const store = memoryStore();
  const sink = memorySink();
  const service = createService({ store, telemetry: createTelemetry([sink]) });
  await assert.rejects(
    service.save({
      day: "MONDAY",
      startAt: new Date(),
      entries: [{ name: "Deadlift", load: "" }],
    }),
    /no entries/,
  );
  assert.equal(store.list.length, 1);
  assert.equal(sink.events.at(-1)?.data.ok, false);
});
