// The APK bundle in Chromium: git repo on IndexedDB through isomorphic-git and lightning-fs.
import { test, expect } from "@playwright/test";

test("seeds the sample routine, saves into the device repo and keeps it across reloads", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator("#day").selectOption("MONDAY");
  await expect(page.locator("#list .row .name").first()).toHaveText("Deadlift");
  await expect(page.locator("#list .row .last")).toHaveCount(0);

  const input = page.locator("#list .row input").first();
  await input.fill("2x4   150kg");
  await input.blur();
  await expect(input).toHaveValue("2x4 150kg");
  await page.locator("#save").click();
  await expect(page.locator("#status")).toContainText("saved 1 exercises");

  await page.reload();
  await page.locator("#day").selectOption("MONDAY");
  await expect(page.locator("#list .row .last").first()).toHaveText(
    "2x4 150kg",
  );
  expect(errors).toEqual([]);
});
