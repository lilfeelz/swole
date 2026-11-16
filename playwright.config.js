import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4173" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: "python3 -m http.server 4173 --bind 127.0.0.1 -d dist/demo",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    stderr: "ignore",
  },
});
