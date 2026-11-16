// Bundle path: both wasm files arrive as bytes, nothing is fetched or read from disk by workline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { init, parseLine, serializeLine } from "../workline/index.js";

test("init from embedded wasm bytes", async () => {
  const bytes = (f) =>
    new Uint8Array(readFileSync(new URL(`../workline/${f}`, import.meta.url)));
  await init({
    language: bytes("workline.wasm"),
    runtime: {
      wasmBinary: bytes("web-tree-sitter.wasm"),
      locateFile: (f) => `/nonexistent/${f}`,
    },
  });
  assert.equal(
    serializeLine(parseLine("Squat / 3x5 / 80kg")),
    "Squat / 3x5 / 80kg",
  );
});
