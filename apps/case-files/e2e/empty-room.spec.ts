import { expect, test } from "@playwright/test";
// Flow d (R21.2, R6.4): the empty room is unfair under v1 and v3 and has exactly one convictable suspect under v2.
test("empty-room: v1 unfair_none, v2 accepted with Dana, v3 unfair_none", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /the empty room/i }).click();
  await page.getByRole("radio", { name: "Dana" }).click();

  const knob = page.getByRole("slider", { name: "RULE VERSION" });
  const accuse = page.getByRole("button", { name: "Accuse", exact: true });
  const glass = page.locator(".xr-glass");
  const unfairNone = page.getByText(/Rule set v\d cannot convict anyone, so this case is unfair\./);

  // v1
  await expect(knob).toHaveAttribute("aria-valuetext", "v1");
  await expect(glass).toHaveAttribute("data-overruled", "true");
  await expect(accuse).toBeDisabled();
  await expect(unfairNone).toContainText("Rule set v1 cannot convict anyone");

  // v2
  await knob.focus();
  await page.keyboard.press("ArrowRight");
  await expect(knob).toHaveAttribute("aria-valuetext", "v2");
  await expect(glass).toHaveAttribute("data-overruled", "false");
  await expect(unfairNone).toHaveCount(0);
  await expect(accuse).toBeEnabled();
  await accuse.click();
  const banner = page.locator(".case-banner");
  await expect(banner).toHaveAttribute("data-verdict", "correct");
  await expect(banner).toContainText("Convictable: Dana.");

  // v3
  await knob.focus();
  await page.keyboard.press("ArrowRight");
  await expect(knob).toHaveAttribute("aria-valuetext", "v3");
  await expect(page.locator(".xr-glass")).toHaveAttribute("data-overruled", "true");
  await expect(page.getByText("Under v3 this case is unfair", { exact: false })).toBeVisible();
});
