/**
 * Async lifecycle hook manager for swole sessions.
 *
 * @returns {{ on: (event: string, fn: Function) => () => void, off: (event: string, fn: Function) => void, emit: (event: string, payload: any) => Promise<void> }} Hook manager instance.
 */
export function createHooks() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  return {
    /**
     * Registers a listener for a hook event.
     *
     * @param {string} event Hook event name.
     * @param {Function} fn Listener callback.
     * @returns {() => void} Unsubscribe function.
     */
    on(event, fn) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      const set = listeners.get(event);
      set.add(fn);
      return () => {
        set.delete(fn);
      };
    },

    /**
     * Unregisters a listener.
     *
     * @param {string} event Hook event name.
     * @param {Function} fn Listener callback.
     */
    off(event, fn) {
      listeners.get(event)?.delete(fn);
    },

    /**
     * Emits a hook event, awaiting all handlers in insertion order.
     *
     * @param {string} event Hook event name.
     * @param {any} payload Event payload.
     * @returns {Promise<void>} Resolves when all handlers complete.
     */
    async emit(event, payload) {
      const set = listeners.get(event);
      if (!set || set.size === 0) return;
      for (const fn of set) {
        await fn(payload);
      }
    },
  };
}
