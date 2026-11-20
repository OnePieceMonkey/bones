import { expect, test } from "@playwright/test";

test("start screen matches the reference image", async ({ page }) => {
  test.skip(true, "refs return in the last task (visual-polish-2 R11.9)");
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  // Three film sheets, one per sample.
  await expect(page.getByRole("group", { name: /load sample receipt/i }).getByRole("button")).toHaveCount(3);
  await expect(page).toHaveScreenshot("start-screen.png");
});
