import { createSheetStore } from "../../stores/sheet.js";
import { createService } from "../../core/service.js";

/**
 * @typedef {import("../../../types/swole.d.ts").Session} Session
 * @typedef {import("../../../types/swole.d.ts").ApiPayload} ApiPayload
 */

/**
 * Returns a configured Service instance for the active spreadsheet.
 *
 * @returns {import("../../../types/swole.d.ts").Api} Swole service.
 */
function getService() {
  const ss = SpreadsheetApp.getActive();
  const store = createSheetStore({ spreadsheet: ss });
  const sheetUrl = ss.getUrl();
  const routineSheet = ss.getSheetByName("routine");
  const logSheet = ss.getSheetByName("log");

  const routineGid = routineSheet ? routineSheet.getSheetId() : 0;
  const logGid = logSheet ? logSheet.getSheetId() : 0;

  return createService({
    store,
    navLinks: {
      routine: `${sheetUrl}#gid=${routineGid}`,
      log: `${sheetUrl}#gid=${logGid}`,
    },
  });
}

/**
 * Serves the mobile web interface.
 *
 * @returns {any} HTML output.
 */
export function doGet() {
  const template = HtmlService.createTemplateFromFile("Index");
  return template
    .evaluate()
    .setTitle("Workout")
    .addMetaTag(
      "viewport",
      "width=device-width, initial-scale=1, viewport-fit=cover",
    )
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Inlines HTML partials (styles, scripts).
 *
 * @param {string} filename Partial file name.
 * @returns {string} File content.
 */
export function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * RPC endpoint to load workout data for a day.
 *
 * @param {string} [day] Day name.
 * @returns {Promise<ApiPayload>} Workout payload.
 */
export async function apiLoad(day) {
  return getService().load(day);
}

/**
 * RPC endpoint to save a completed workout session.
 *
 * @param {Session} session Completed session.
 * @returns {Promise<{ ok: boolean, saved: number, id: string }>} Save result.
 */
export async function apiSave(session) {
  return getService().save(session);
}
