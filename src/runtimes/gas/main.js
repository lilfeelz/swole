import { mount } from "../../ui/app.js";

/**
 * Calls a server function through google.script.run as a Promise.
 *
 * @param {string} fn Server function name.
 * @returns {(...args: any[]) => Promise<any>} Remote call.
 */
const run =
  (fn) =>
  (...args) =>
    new Promise((ok, err) => {
      const r = google.script.run
        .withSuccessHandler(ok)
        .withFailureHandler(err);
      r[fn](...args);
    });

mount({
  load: run("apiLoad"),
  start: run("apiStart"),
  stop: run("apiStop"),
  save: run("apiSave"),
  track: run("apiTrack"),
});
