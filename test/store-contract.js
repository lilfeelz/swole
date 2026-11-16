import test from "node:test";
import assert from "node:assert/strict";

/**
 * Runs a conformance suite against any Store implementation.
 *
 * @param {string} name Store name.
 * @param {() => Promise<import("../types/swole.d.ts").Store>} createStore Factory creating a clean store instance.
 */
export function testStoreContract(name, createStore) {
  test(`${name} conforms to Store contract`, async () => {
    const store = await createStore();

    // 1. routine()
    const routine = await store.routine();
    assert.ok(typeof routine === "object" && routine !== null);
    const days = Object.keys(routine);
    assert.ok(days.length > 0, "Routine must contain at least one day");
    const firstDay = days[0];
    assert.ok(Array.isArray(routine[firstDay]));

    // 2. sessions()
    const initialSessions = await store.sessions();
    assert.ok(Array.isArray(initialSessions));

    // 3. append(session)
    /** @type {import("../types/swole.d.ts").Session} */
    const newSession = {
      day: firstDay,
      startAt: new Date(Date.now() - 3600000),
      endAt: new Date(),
      entries: [{ name: "Squat", load: "1x5 / 100kg" }],
    };

    const id = await store.append(newSession);
    assert.ok(typeof id === "string" && id.length > 0);

    const updatedSessions = await store.sessions();
    assert.equal(updatedSessions.length, initialSessions.length + 1);
    const saved = updatedSessions[updatedSessions.length - 1];
    assert.equal(saved.day, firstDay);
    assert.equal(saved.entries.length, 1);
    assert.equal(saved.entries[0].name, "Squat");

    // 4. getActive / setActive (optional methods)
    if (store.getActive && store.setActive) {
      assert.equal(await store.getActive(), null);

      /** @type {import("../types/swole.d.ts").Session} */
      const activeSession = {
        day: firstDay,
        startAt: new Date(),
        entries: [],
      };

      await store.setActive(activeSession);
      const retrieved = await store.getActive();
      assert.ok(retrieved !== null);
      assert.equal(retrieved.day, firstDay);

      await store.setActive(null);
      assert.equal(await store.getActive(), null);
    }
  });
}
