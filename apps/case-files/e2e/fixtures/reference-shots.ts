import { expect, type Page } from "@playwright/test";

// Shared steps of the reference specs (R21.4). The tests themselves live in reference.spec.ts and
// reference-1600.spec.ts, so each screenshot path follows its own spec file name.
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.xr-shell[data-intro="done"]')).toBeVisible();
  // Park the pointer so no hover state reaches the picture.
  await page.mouse.move(0, 0);
}

export async function openStartScreen(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

export async function openFairVerdict(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /midnight greenhouse/i }).click();
  await page.getByRole("radio", { name: "the widow" }).click();
  await page.getByRole("button", { name: "Accuse", exact: true }).click();
  await expect(page.locator(".case-banner")).toContainText("CASE CLOSED");
  await expect(page.locator(".xr-shell")).toHaveAttribute("data-intro", "done");
  await settle(page);
}

export async function openRejectedCandlesticks(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /two candlesticks/i }).click();
  await page.getByRole("radio", { name: "Ada" }).click();
  await expect(page.locator(".xr-glass")).toHaveAttribute("data-overruled", "true");
  await expect(page.locator(".xr-glass .xr-glass-stamp")).toContainText("OVERRULED BY RULE");
  await expect(page.locator(".xr-shell")).toHaveAttribute("data-intro", "done");
  await settle(page);
}
