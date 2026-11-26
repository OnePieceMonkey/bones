import { expect, test } from "@playwright/test";
// Flow e (R21.2, R12.4, R12.5): a human overrides a rejected case; the rules' fractures stay as they were.
test("candlesticks v1: human override to approved enables Accuse and leaves the fractures alone", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /two candlesticks/i }).click();
  await page.getByRole("radio", { name: "Ada" }).click();
  await page.getByRole("switch", { name: "X-RAY" }).click();
  await expect(page.locator(".xr-ensemble-stage")).toBeVisible();

  const accuse = page.getByRole("button", { name: "Accuse", exact: true });
  await expect(accuse).toBeDisabled();
  const fractured = () =>
    page
      .locator('.xr-hotspot[data-state="fractured"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-rule-id") ?? "").sort());
  const before = await fractured();
  expect(before.length).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Human override" }).click();
  const dialog = page.getByRole("dialog", { name: "Overrule verdict" });
  await dialog.getByLabel("Reviewer name").fill("Inspector Vale");
  await dialog.getByLabel("Reason").fill("Reviewed the witness list by hand.");
  await dialog.getByLabel("New result").selectOption("approved");
  await dialog.getByRole("button", { name: "Save override" }).click();
  await expect(dialog).toBeHidden();

  await expect(accuse).toBeEnabled();
  await expect(page.getByText("overruled by Inspector Vale")).toBeVisible();
  await expect(page.getByText("Rules decided: rejected")).toBeVisible();
  expect(await fractured()).toEqual(before);
});
