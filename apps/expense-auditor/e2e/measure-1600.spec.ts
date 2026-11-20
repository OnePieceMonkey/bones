import { expect, test, type Page } from "@playwright/test";

// visual-polish-2: measurements at 1600x900. Later tasks append their assertions here.

const SIZES = [
  { width: 1600, height: 900 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

function scrollDims(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }));
}

for (const size of SIZES) {
  test(`no page scroll on start and signature screens at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(page.getByRole("group", { name: /load sample receipt/i }).getByRole("button")).toHaveCount(3);
    const start = await scrollDims(page);
    expect(start.scrollHeight, "start screen height").toBeLessThanOrEqual(start.innerHeight);
    expect(start.scrollWidth, "start screen width").toBeLessThanOrEqual(start.innerWidth);

    await page.getByRole("button", { name: /signature case/i }).click();
    await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
    const sig = await scrollDims(page);
    expect(sig.scrollHeight, "signature screen height").toBeLessThanOrEqual(sig.innerHeight);
    expect(sig.scrollWidth, "signature screen width").toBeLessThanOrEqual(sig.innerWidth);
  });
}
