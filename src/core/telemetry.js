/**
 * @typedef {object} TelemetryEvent
 * @property {string} category Event category.
 * @property {string} action Event action.
 * @property {string} [label] Optional label.
 * @property {any} [data] Optional data payload.
 * @property {string} [timestamp] ISO timestamp.
 */

/**
 * Creates an in-memory telemetry sink for testing and inspection.
 *
 * @returns {{ events: TelemetryEvent[], write: (evt: TelemetryEvent) => Promise<void>, clear: () => void }} Memory sink instance.
 */
export function memorySink() {
  /** @type {TelemetryEvent[]} */
  const events = [];
  return {
    events,
    /**
     * Appends an event to the internal list.
     *
     * @param {TelemetryEvent} evt Telemetry event.
     * @returns {Promise<void>} Resolves when recorded.
     */
    async write(evt) {
      events.push(evt);
    },
    clear() {
      events.length = 0;
    },
  };
}

/**
 * Creates a console telemetry sink.
 *
 * @returns {{ write: (evt: TelemetryEvent) => Promise<void> }} Console sink instance.
 */
export function consoleSink() {
  return {
    /**
     * Logs an event to standard console.
     *
     * @param {TelemetryEvent} evt Telemetry event.
     * @returns {Promise<void>} Resolves when logged.
     */
    async write(evt) {
      console.log(
        `[telemetry] ${evt.category}/${evt.action}${evt.label ? ` (${evt.label})` : ""}`,
        evt.data || "",
      );
    },
  };
}

/**
 * Creates a JSONL file telemetry sink.
 *
 * @param {string} filePath Destination file path.
 * @param {{ appendFile: (path: string, data: string, enc: any) => Promise<void> }} fs File system interface.
 * @returns {{ write: (evt: TelemetryEvent) => Promise<void> }} JSONL file sink instance.
 */
export function jsonlSink(filePath, fs) {
  return {
    /**
     * Appends an event line to the JSONL file.
     *
     * @param {TelemetryEvent} evt Telemetry event.
     * @returns {Promise<void>} Resolves when written.
     */
    async write(evt) {
      if (!fs || !fs.appendFile) return;
      const line = JSON.stringify(evt) + "\n";
      await fs.appendFile(filePath, line, "utf8");
    },
  };
}

/**
 * Telemetry manager that broadcasts events to multiple sinks.
 *
 * @param {Array<{ write: (evt: TelemetryEvent) => Promise<void> | void }>} [sinks] Initial sinks list.
 * @returns {{ addSink: (sink: { write: (evt: TelemetryEvent) => Promise<void> | void }) => void, track: (event: Omit<TelemetryEvent, "timestamp"> & { timestamp?: string }) => Promise<void> }} Telemetry manager.
 */
export function createTelemetry(sinks = []) {
  const activeSinks = [...sinks];
  return {
    /**
     * Adds an active telemetry sink.
     *
     * @param {{ write: (evt: TelemetryEvent) => Promise<void> | void }} sink Telemetry sink.
     */
    addSink(sink) {
      activeSinks.push(sink);
    },
    /**
     * Records an event across all sinks.
     *
     * @param {Omit<TelemetryEvent, "timestamp"> & { timestamp?: string }} event Telemetry event without timestamp.
     * @returns {Promise<void>} Resolves when dispatched to all sinks.
     */
    async track(event) {
      const payload = {
        ...event,
        timestamp: event.timestamp || new Date().toISOString(),
      };
      for (const sink of activeSinks) {
        try {
          await sink.write(payload);
        } catch (err) {
          console.error("Telemetry sink error:", err);
        }
      }
    },
  };
}
