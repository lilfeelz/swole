// Renders docs/screenshot.png from the demo build: npm run build && npm run screenshot.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium, devices } from "@playwright/test";

const dist = new URL("../dist/demo/", import.meta.url);
const server = createServer(async (req, res) => {
  const name = req.url === "/" ? "index.html" : req.url.slice(1);
  res.end(await readFile(new URL(name, dist)).catch(() => ""));
}).listen(0, "127.0.0.1");
await new Promise((ok) => server.once("listening", ok));

const browser = await chromium.launch();
const page = await (await browser.newContext(devices["Pixel 5"])).newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.locator("#day").selectOption("MONDAY");
const inputs = page.locator("#list .row input");
await inputs.nth(0).fill("2x4 / 145kg");
await inputs.nth(1).fill("heavy");
await inputs.nth(2).click();
await page.locator("#list .row.invalid").waitFor();
await page.locator("#list .row.invalid .name").click();
if (!(await page.locator("#save").isDisabled()))
  throw new Error("save not disabled");
await page.waitForTimeout(300); // let the 0.15s opacity transition finish
await page.screenshot({
  path: new URL("../docs/screenshot.png", import.meta.url).pathname,
});
await browser.close();
server.close();
