import { createBrowserStore } from "../../stores/browser.js";
import { createService } from "../../core/service.js";
import { createTelemetry, consoleSink } from "../../core/telemetry.js";
import { parseSession } from "../../core/model.js";
import { mount } from "../../ui/app.js";

/* global SWOLE_SAMPLE */
const store = createBrowserStore({
  initialRoutine: SWOLE_SAMPLE.routine,
  initialSessions: SWOLE_SAMPLE.logs.map(parseSession),
});
mount(createService({ store, telemetry: createTelemetry([consoleSink()]) }));
