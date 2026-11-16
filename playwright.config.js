import { defineConfig, devices } from "@playwright/test";

const serve = (dir, port) => ({
  command: `python3 -m http.server ${port} --bind 127.0.0.1 -d dist/${dir}`,
  url: `http://127.0.0.1:${port}`,
  reuseExistingServer: !process.env.CI,
  stderr: /** @type {const} */ ("ignore"),
});

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  projects: [
    {
      name: "chromium",
      testMatch: "demo.spec.js",
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4173" },
    },
    {
      name: "mobile-chrome",
      testMatch: "demo.spec.js",
      use: { ...devices["Pixel 5"], baseURL: "http://127.0.0.1:4173" },
    },
    {
      name: "apk",
      testMatch: "apk.spec.js",
      use: { ...devices["Pixel 5"], baseURL: "http://127.0.0.1:4174" },
    },
  ],
  webServer: [serve("demo", 4173), serve("apk", 4174)],
});
