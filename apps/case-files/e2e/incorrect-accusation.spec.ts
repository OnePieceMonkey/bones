import { expect, test } from "@playwright/test";
// Flow b (R21.2): a wrong accusation, the banner names who could be convicted.
test("greenhouse: accusing the gardener is a wrong suspect", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /midnight greenhouse/i }).click();
  await page.getByRole("radio", { name: "the gardener" }).click();
  await page.getByRole("button", { name: "Accuse", exact: true }).click();
  const banner = page.locator(".case-banner");
  await expect(banner).toContainText("WRONG SUSPECT");
  await expect(banner).toHaveAttribute("data-verdict", "incorrect");
  await expect(banner).toContainText("Convictable: the widow.");
  await expect(page.locator('.xr-ensemble-plate[data-member-id="gardener"]')).toHaveAttribute("data-accused", "true");
});
