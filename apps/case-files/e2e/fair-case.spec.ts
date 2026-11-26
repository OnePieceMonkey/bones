import { expect, test } from "@playwright/test";
// Flow a (R21.2): the fair case, accused correctly.
test("greenhouse: accusing the widow closes the case", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /midnight greenhouse/i }).click();
  const xray = page.getByRole("switch", { name: "X-RAY" });
  await expect(xray).toHaveAttribute("aria-checked", "false");
  await expect(page.locator(".xr-ensemble-stage")).toHaveCount(0);
  await page.getByRole("radio", { name: "the widow" }).click();
  await page.getByRole("button", { name: "Accuse", exact: true }).click();
  const banner = page.locator(".case-banner");
  await expect(banner).toContainText("CASE CLOSED");
  await expect(banner).toHaveAttribute("data-verdict", "correct");
  await expect(page.locator('.xr-ensemble-plate[data-member-id="widow"]')).toHaveAttribute("data-accused", "true");
  await expect(page.locator('.xr-ensemble-plate[data-member-id="gardener"]')).toHaveAttribute("data-accused", "false");
  await expect(page.getByRole("switch", { name: "X-RAY" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".xr-ensemble-stage")).toBeVisible();
});
