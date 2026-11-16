import { createKvStore } from "../../stores/kv.js";
import { createService } from "../../core/service.js";
import { createTelemetry, consoleSink } from "../../core/telemetry.js";
import { handler } from "../../core/http.js";

export default {
  /**
   * Serves /api/* from Workers KV; everything else is the local UI bundle from static assets.
   *
   * @param {Request} req Incoming request.
   * @param {{ SWOLE_KV: any, ASSETS: { fetch: (r: Request) => Promise<Response> } }} env Bindings.
   * @returns {Promise<Response>} Response.
   */
  async fetch(req, env) {
    const api = handler(
      createService({
        store: createKvStore({ kv: env.SWOLE_KV }),
        telemetry: createTelemetry([consoleSink()]),
      }),
    );
    return (await api(req)) ?? env.ASSETS.fetch(req);
  },
};
