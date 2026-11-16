// Worker over fake KV and assets bindings: api routes hit KV, other paths go to the assets.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/runtimes/cf/worker.js";

const kv = new Map([
  ["routine", JSON.stringify({ MONDAY: [{ name: "Squat", scheme: "3x5" }] })],
]);
const env = {
  SWOLE_KV: {
    get: async (k, t) =>
      kv.has(k) ? (t === "json" ? JSON.parse(kv.get(k)) : kv.get(k)) : null,
    put: async (k, v) => void kv.set(k, String(v)),
    delete: async (k) => void kv.delete(k),
  },
  ASSETS: { fetch: async () => new Response("ui") },
};
const call = (path, body) =>
  worker.fetch(
    new Request(
      `https://swole.test${path}`,
      body && { method: "POST", body: JSON.stringify(body) },
    ),
    env,
  );

test("worker saves to KV under the start time and serves last loads", async () => {
  const res = await call("/api/save", {
    session: {
      day: "MONDAY",
      startAt: "2026-11-16T18:00:00.000Z",
      endAt: "2026-11-16T19:00:00.000Z",
      entries: [{ name: "Squat", load: "3x5 / 100kg" }],
    },
  });
  assert.deepEqual(await res.json(), { ok: true, saved: 1, id: "1794852000" });
  assert.deepEqual(JSON.parse(kv.get("index:sessions")), ["log:1794852000"]);
  const load = await (await call("/api/load?day=MONDAY")).json();
  assert.equal(load.program[0].last, "3x5 / 100kg");
});

test("worker rejects an invalid session with 400 and passes other paths to assets", async () => {
  const bad = await call("/api/save", {
    session: { day: "MONDAY", entries: [] },
  });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /START/);
  assert.equal(await (await call("/")).text(), "ui");
});
