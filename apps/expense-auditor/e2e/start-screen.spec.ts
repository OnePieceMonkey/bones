import { expect, test } from "@playwright/test";

test("start screen matches the reference image", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  // Three film sheets, one per sample.
  await expect(page.getByRole("group", { name: /load sample receipt/i }).getByRole("button")).toHaveCount(3);
  await expect(page).toHaveScreenshot("start-screen.png");
});
