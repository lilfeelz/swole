import { createKvStore } from "../../stores/kv.js";
import { createService } from "../../core/service.js";

/**
 * Cloudflare Worker entry point for Swole.
 */
export default {
  /**
   * Handles incoming HTTP requests.
   *
   * @param {Request} request Incoming request.
   * @param {{ SWOLE_KV: any }} env Environment bindings.
   * @returns {Promise<Response>} HTTP response.
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    const store = createKvStore({ kv: env.SWOLE_KV });
    const service = createService({ store });

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (
      url.pathname === "/api/load" &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      if (request.method === "HEAD") {
        return new Response(null, { status: 200, headers: corsHeaders });
      }
      const day = url.searchParams.get("day") || undefined;
      const data = await service.load(day);
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (url.pathname === "/api/start" && request.method === "POST") {
      const { day } = await request.json();
      const session = await service.start(day);
      return new Response(JSON.stringify(session), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (url.pathname === "/api/stop" && request.method === "POST") {
      const { session } = await request.json();
      const stopped = await service.stop(session);
      return new Response(JSON.stringify(stopped), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (url.pathname === "/api/save" && request.method === "POST") {
      const { session } = await request.json();
      session.startAt = new Date(session.startAt);
      if (session.endAt) session.endAt = new Date(session.endAt);
      const result = await service.save(session);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (url.pathname === "/api/track" && request.method === "POST") {
      const { event } = await request.json();
      await service.track(event);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
