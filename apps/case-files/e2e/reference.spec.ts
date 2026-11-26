import { expect, test } from "@playwright/test";
import { openFairVerdict, openRejectedCandlesticks, openStartScreen } from "./fixtures/reference-shots";
// R21.4: reference screenshots at 1440x900 (project chromium).
test("start screen matches the reference image", async ({ page }) => {
  await openStartScreen(page);
  await expect(page).toHaveScreenshot("start-screen.png", { animations: "disabled" });
});
test("fair case verdict view matches the reference image", async ({ page }) => {
  await openFairVerdict(page);
  await expect(page).toHaveScreenshot("verdict-fair.png", { animations: "disabled" });
});
test("candlesticks rejected under v1 matches the reference image", async ({ page }) => {
  await openRejectedCandlesticks(page);
  await expect(page).toHaveScreenshot("rejected-candlesticks.png", { animations: "disabled" });
});
