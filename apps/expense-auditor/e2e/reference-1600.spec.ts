import { expect, test } from "@playwright/test";

// visual-polish-2 R11.1: reference screenshots at 1600x900 (project chromium-1600).

test("start screen matches the 1600 reference image", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  // Three film sheets, one per sample.
  await expect(page.getByRole("group", { name: /load sample receipt/i }).getByRole("button")).toHaveCount(3);
  await expect(page).toHaveScreenshot("start-screen-1600.png");
});

test("signature case matches the 1600 reference image", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /signature case/i }).click();
  await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
  await expect(page).toHaveScreenshot("signature-case-1600.png");
});
