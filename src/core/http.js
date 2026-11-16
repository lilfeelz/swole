/**
 * @typedef {import("../../types/swole.d.ts").Api} Api
 */

/**
 * Api over fetch against a swole http handler.
 *
 * @param {string} [base] URL prefix, "" for same origin.
 * @returns {Api} Remote transport.
 */
export function client(base = "") {
  const call = async (path, body) => {
    const res = await fetch(
      `${base}/api/${path}`,
      body === undefined
        ? undefined
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || res.statusText);
    return out;
  };
  return {
    load: (day) => call(`load${day ? `?day=${encodeURIComponent(day)}` : ""}`),
    start: (day) => call("start", { day }),
    stop: (session) => call("stop", { session }),
    save: (session) => call("save", { session }),
    track: (event) => call("track", { event }),
  };
}

/**
 * Serves an Api over /api/* with web-standard Request and Response.
 *
 * @param {Api} api Service to expose.
 * @returns {(req: Request) => Promise<Response | null>} Handler; null for paths outside /api/.
 */
export function handler(api) {
  return async (req) => {
    const url = new URL(req.url);
    const route = url.pathname.match(
      /^\/api\/(load|start|stop|save|track)$/,
    )?.[1];
    if (!route) return null;
    try {
      const body = req.method === "POST" ? await req.json() : {};
      const out =
        route === "load"
          ? await api.load(url.searchParams.get("day") ?? undefined)
          : route === "start"
            ? await api.start(body.day)
            : route === "track"
              ? await api.track(body.event)
              : await api[route](body.session);
      return Response.json(out ?? { ok: true });
    } catch (e) {
      return Response.json({ error: String(e?.message ?? e) }, { status: 400 });
    }
  };
}
