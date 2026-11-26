import { expect, test } from "@playwright/test";
// Flow c (R21.2, R6.4, R6.5): a rejected case becomes accepted when the knob is turned to v2.
test("candlesticks: v1 rejects the case, v2 accepts it", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /two candlesticks/i }).click();
  await page.getByRole("radio", { name: "Ada" }).click();

  const glass = page.locator(".xr-glass");
  const stamp = glass.locator(".xr-glass-stamp");
  const accuse = page.getByRole("button", { name: "Accuse", exact: true });

  // v1: rejected, stamp inside the cracked Glass_Card, Accuse disabled with a reason.
  await expect(glass).toHaveAttribute("data-overruled", "true");
  await expect(stamp).toContainText("OVERRULED BY RULE");
  const glassBox = await glass.boundingBox();
  const stampBox = await stamp.boundingBox();
  expect(glassBox).not.toBeNull();
  expect(stampBox).not.toBeNull();
  expect(stampBox!.x).toBeGreaterThanOrEqual(glassBox!.x - 1);
  expect(stampBox!.y).toBeGreaterThanOrEqual(glassBox!.y - 1);
  expect(stampBox!.x + stampBox!.width).toBeLessThanOrEqual(glassBox!.x + glassBox!.width + 1);
  expect(stampBox!.y + stampBox!.height).toBeLessThanOrEqual(glassBox!.y + glassBox!.height + 1);
  await expect(accuse).toBeDisabled();
  await expect(page.locator("#accuse-reason")).toContainText("Rule set v1 found this case unfair");
  await expect(page.getByRole("status").filter({ hasText: "Replayed with" })).toHaveCount(0);

  // Turn the knob to v2.
  const knob = page.getByRole("slider", { name: "RULE VERSION" });
  await knob.focus();
  await page.keyboard.press("ArrowRight");
  await expect(knob).toHaveAttribute("aria-valuetext", "v2");
  await expect(page.getByRole("status").filter({ hasText: "Replayed with v2. Original: v1." })).toBeVisible();
  await expect(glass).toHaveAttribute("data-overruled", "false");
  await expect(stamp).toHaveCount(0);
  await expect(accuse).toBeEnabled();
  await expect(page.locator("#accuse-reason")).toHaveCount(0);
});
