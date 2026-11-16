import { createSheetStore } from "../../stores/sheet.js";
import { createService } from "../../core/service.js";
import { createTelemetry, consoleSink } from "../../core/telemetry.js";

/**
 * Service over the bound spreadsheet; Routine and Log tabs link to their sheet tabs.
 *
 * @returns {import("../../../types/swole.d.ts").Api} Swole service.
 */
function service() {
  const ss = SpreadsheetApp.getActive();
  const gid = (...names) =>
    names
      .map((n) => ss.getSheetByName(n))
      .find(Boolean)
      ?.getSheetId();
  const link = (g) => (g === undefined ? undefined : `${ss.getUrl()}#gid=${g}`);
  return createService({
    store: createSheetStore({ spreadsheet: ss }),
    telemetry: createTelemetry([consoleSink()]),
    navLinks: {
      routine: link(gid("routine", "ad infinitum", "ad infinitium")),
      log: link(gid("log")),
    },
  });
}

/**
 * google.script.run drops Dates, so results cross as JSON.
 *
 * @param {Promise<any>} p Service result.
 * @returns {Promise<any>} Plain result.
 */
const plain = async (p) => JSON.parse(JSON.stringify((await p) ?? null));

/**
 * Serves the UI; the file is plain HTML, never evaluated as a template.
 *
 * @returns {any} HTML output.
 */
export function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Workout")
    .addMetaTag(
      "viewport",
      "width=device-width, initial-scale=1, viewport-fit=cover",
    );
}

export const apiLoad = (day) => plain(service().load(day));
export const apiStart = (day) => plain(service().start(day));
export const apiStop = (s) => plain(service().stop(s));
export const apiSave = (s) => plain(service().save(s));
export const apiTrack = (e) => plain(service().track(e));
