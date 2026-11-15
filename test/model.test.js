import test from "node:test";
import assert from "node:assert/strict";
import {
  DAYS,
  key,
  cleanLoad,
  resolveDay,
  parseRoutine,
  validateRoutine,
  parseSession,
  formatSession,
  validateSession,
  isoWeekParts,
  logPathForSession,
  lastLoadsFromSessions,
} from "../src/core/model.js";

test("key normalizes names correctly", () => {
  assert.equal(key("Bench Press"), "benchpress");
  assert.equal(key("Pull-Up (Weighted)"), "pullupweighted");
});

test("cleanLoad strips reps and trims", () => {
  assert.equal(cleanLoad("100kg x 5 reps"), "100kg x 5");
  assert.equal(cleanLoad("90kg x 6r"), "90kg x 6");
  assert.equal(cleanLoad("45s"), "45s");
});

test("resolveDay picks today or parses input", () => {
  assert.ok(DAYS.includes(resolveDay("")));
  assert.equal(resolveDay("Monday"), "MONDAY");
  assert.equal(resolveDay("Leg Day"), "LEG DAY");
});

test("parseRoutine extracts days and exercises skipping cardio", () => {
  const text = `
MONDAY
Deadlift | 3x4-6
Bike | 20m
Bench Press | 3x6-8

WEDNESDAY
Squat | 3x5
`;
  const routine = parseRoutine(text);
  assert.equal(routine.MONDAY.length, 2);
  assert.equal(routine.MONDAY[0].name, "Deadlift");
  assert.equal(routine.MONDAY[0].scheme, "3x4-6");
  assert.equal(routine.MONDAY[1].name, "Bench Press");
  assert.equal(routine.WEDNESDAY.length, 1);
  assert.equal(validateRoutine(routine).ok, true);
});

test("parseSession and formatSession roundtrip cleanly", () => {
  const raw = `DAY: MONDAY
START: 2026-11-15T18:00:00.000Z
END: 2026-11-15T18:55:00.000Z

Deadlift | 140kg x 5
Bench Press | 92.5kg x 6
`;
  const parsed = parseSession(raw);
  assert.equal(parsed.day, "MONDAY");
  assert.equal(parsed.entries.length, 2);
  assert.equal(validateSession(parsed).ok, true);

  const formatted = formatSession(parsed);
  assert.ok(formatted.includes("DAY: MONDAY"));
  assert.ok(formatted.includes("Deadlift | 140kg x 5"));
});

test("isoWeekParts and logPathForSession compute correct path", () => {
  const d = new Date("2026-11-15T18:00:00.000Z");
  const parts = isoWeekParts(d);
  assert.equal(parts.yy, "26");
  assert.equal(parts.ww, "46");
  const p = logPathForSession({ startAt: d });
  assert.equal(p, "data/log/26/46/1794765600.txt");
});

test("lastLoadsFromSessions aggregates latest load per exercise", () => {
  const sessions = [
    {
      startAt: new Date("2026-11-01T10:00:00Z"),
      entries: [{ name: "Squat", load: "100kg x 5" }],
    },
    {
      startAt: new Date("2026-11-08T10:00:00Z"),
      entries: [{ name: "Squat", load: "105kg x 5" }],
    },
  ];
  const loads = lastLoadsFromSessions(sessions);
  assert.equal(loads["squat"], "105kg x 5");
});
