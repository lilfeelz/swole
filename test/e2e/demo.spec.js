import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page, context }) => {
  await context.route("https://github.com/**", (r) => r.fulfill({ body: "" }));
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

test("loads Monday sample routine and last loads", async ({ page }) => {
  await page.locator("#day").selectOption("MONDAY");
  await expect(page.locator("#title")).toHaveText("MONDAY");

  const exercises = page.locator("#list .row .name");
  await expect(exercises).toHaveCount(4);
  await expect(exercises.nth(0)).toHaveText("Deadlift");
  await expect(exercises.nth(1)).toHaveText("Bench Press");
  await expect(exercises.nth(2)).toHaveText("Pull-Up");
  await expect(exercises.nth(3)).toHaveText("Front Squat");

  const schemes = page.locator("#list .row .scheme");
  await expect(schemes.nth(0)).toHaveText("2x4+");
  await expect(schemes.nth(1)).toHaveText("3x6+");
  await expect(schemes.nth(2)).toHaveText("3x6+");
  await expect(schemes.nth(3)).toHaveText("2x6+");

  const inputs = page.locator("#list .row input");
  const hints = ["2x4 / 140kg", "3x6 / 90kg", "3x6 / 15kg", "2x6 / 80kg"];
  for (const [i, hint] of hints.entries())
    await expect(inputs.nth(i)).toHaveAttribute("placeholder", hint);
});

test("toggles workout timer on clock click", async ({ page }) => {
  const clock = page.locator("#clock");
  await expect(clock).toHaveText("00:00:00");
  await expect(clock).not.toHaveClass(/running/);

  await clock.click();
  await expect(clock).toHaveClass(/running/);

  await page.waitForTimeout(1100);
  const textRunning = await clock.textContent();
  expect(textRunning).not.toBe("00:00:00");

  await clock.click();
  await expect(clock).not.toHaveClass(/running/);
});

test("switches day to Thursday and loads Thursday exercises", async ({
  page,
}) => {
  await page.locator("#day").selectOption("THURSDAY");

  const exercises = page.locator("#list .row .name");
  await expect(exercises).toHaveCount(4);
  await expect(exercises.nth(0)).toHaveText("Back Squat");
  await expect(exercises.nth(1)).toHaveText("Overhead Press");
  await expect(exercises.nth(2)).toHaveText("Row");
  await expect(exercises.nth(3)).toHaveText("Rev. Nordic Curl");
});

test("persists draft input values and active timer across page reload", async ({
  page,
}) => {
  await page.locator("#day").selectOption("MONDAY");
  await page.locator("#clock").click();
  await expect(page.locator("#clock")).toHaveClass(/running/);

  const firstInput = page.locator("#list .row input").first();
  await firstInput.fill("2x4 / 142.5kg");

  await page.reload();

  await expect(page.locator("#clock")).toHaveClass(/running/);
  await expect(page.locator("#list .row input").first()).toHaveValue(
    "2x4 / 142.5kg",
  );
});

test("adds custom exercise via modal", async ({ page }) => {
  await page.locator("#day").selectOption("MONDAY");
  await page.locator("#add-btn").click();
  const modal = page.locator("#modal");
  await expect(modal).toBeVisible();

  await page.locator("#modal-input").fill("Dips");
  await page.locator("#modal-confirm").click();
  await expect(modal).toBeHidden();

  const names = page.locator("#list .row .name");
  await expect(names).toHaveCount(5);
  await expect(names.nth(4)).toHaveText("Dips");
});

test("saves completed session and clears timer and drafts", async ({
  page,
}) => {
  await page.locator("#day").selectOption("MONDAY");
  await page.locator("#clock").click();
  await page.locator("#list .row input").first().fill("2x4 / 145kg");

  await page.locator("#save").click();

  const status = page.locator("#status");
  await expect(status).toContainText("saved 1 exercises");
  await expect(page.locator("#clock")).toHaveText("00:00:00");
  await expect(page.locator("#clock")).not.toHaveClass(/running/);
  const first = page.locator("#list .row input").first();
  await expect(first).toHaveAttribute("placeholder", "2x4 / 145kg");
  await page.reload();
  await expect(first).toHaveAttribute("placeholder", "2x4 / 145kg");
});

test("opens feedback modal and triggers pre-filled GitHub issue URL", async ({
  page,
}) => {
  await page.locator("#day").selectOption("MONDAY");
  await page.locator("#feedback-btn").click();

  const modal = page.locator("#feedback-modal");
  await expect(modal).toBeVisible();

  await expect(page.locator("#type-bug")).toHaveClass(/active/);
  await page.locator("#type-feature").click();
  await expect(page.locator("#type-feature")).toHaveClass(/active/);
  await expect(page.locator("#type-bug")).not.toHaveClass(/active/);

  await page.locator("#feedback-input").fill("Add RPE tracker");

  const [newPage] = await Promise.all([
    page.waitForEvent("popup"),
    page.locator("#feedback-submit").click(),
  ]);

  await expect(modal).toBeHidden();
  const url = newPage.url();
  expect(url).toContain("github.com/lilfeelz/swole/issues/new");
  expect(url).toContain("labels=enhancement");
  expect(url).toContain("Add+RPE+tracker");
});

test("clicking error status toast opens pre-filled bug report in feedback modal", async ({
  page,
}) => {
  await page.locator("#day").selectOption("MONDAY");
  await page.locator("#save").click();

  const status = page.locator("#status");
  await expect(status).toHaveClass(/err/);
  await expect(status).toHaveText("Enter at least one load");

  await status.click();

  const modal = page.locator("#feedback-modal");
  await expect(modal).toBeVisible();
  await expect(page.locator("#type-bug")).toHaveClass(/active/);
  await expect(page.locator("#feedback-input")).toHaveValue(
    /Error: Enter at least one load/,
  );
});

test("demo has no backend editors: Routine and Log tabs are disabled", async ({
  page,
}) => {
  await expect(page.locator("#tab-session")).toHaveClass(/active/);
  await expect(page.locator("#tab-routine")).toHaveClass(/disabled/);
  await expect(page.locator("#tab-log")).toHaveClass(/disabled/);
  await expect(page.locator("#tab-routine")).not.toHaveAttribute("href");
});

test("canonicalises a valid line on blur without fetching wasm", async ({
  page,
}) => {
  const wasm = [];
  page.on("request", (r) => r.url().includes(".wasm") && wasm.push(r.url()));
  await page.reload();
  await page.locator("#day").selectOption("MONDAY");
  const input = page.locator("#list .row input").first();
  await input.fill("2x4   140kg  2min");
  await input.blur();
  await expect(input).toHaveValue("2x4 140kg 2m");
  await expect(page.locator("#list .row.invalid")).toHaveCount(0);
  expect(wasm).toEqual([]);
});

test("an invalid line shows the reason and blocks save until fixed", async ({
  page,
}) => {
  await page.locator("#day").selectOption("MONDAY");
  const row = page.locator("#list .row").first();
  const input = row.locator("input");
  await input.fill("heavy");
  await input.blur();
  await expect(row).toHaveClass(/invalid/);
  await expect(row.locator(".err")).toBeHidden();
  await row.locator(".name").click();
  await expect(row.locator(".err")).toContainText("unexpected");
  await expect(page.locator("#save")).toBeDisabled();

  await input.fill("Deadlift / 2x4");
  await input.blur();
  await expect(row.locator(".err")).toHaveText("leave out the exercise name");

  await input.fill("2x4 / 150kg");
  await input.blur();
  await expect(row).not.toHaveClass(/invalid/);
  await expect(page.locator("#save")).toBeEnabled();
  await page.locator("#save").click();
  await expect(page.locator("#status")).toContainText("saved 1 exercises");
});
