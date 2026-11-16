import { init, parseLine, serializeLine } from "../workline/index.js";

/* global WORKLINE_WASM, TS_WASM */
const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Resolves once workline can parse. Bundles carry both wasm files as base64; unbundled Node reads them from disk. */
export const ready =
  typeof WORKLINE_WASM === "string"
    ? init({
        language: bytes(WORKLINE_WASM),
        runtime: { wasmBinary: bytes(TS_WASM), locateFile: (f) => f },
      })
    : init();

/**
 * Canonicalises a reduced workline (no exercise name); throws with the reason when invalid.
 *
 * @param {string} reduced Reduced line, e.g. "3x5 / 80kg".
 * @returns {string} Canonical reduced line.
 */
export function canon(reduced) {
  const line = parseLine(reduced);
  if (line.name) throw new Error("leave out the exercise name");
  return serializeLine(line);
}
