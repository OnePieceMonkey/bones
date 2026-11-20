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

// visual-polish-2 task 2.1: unboxed labels and no dashed outlines (R1.1, R1.2, R1.4).
async function openSample(page: Page, name: RegExp): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name }).click();
  await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
}
test("panel labels and the doctor name draw no box (R1.1)", async ({ page }) => {
  await openSample(page, /signature case/i);
  for (const selector of [".xr-cpanel-plaque", ".xr-doctor-title"]) {
    const boxes = await page.$$eval(selector, (els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        return {
          widths: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
          bg: s.backgroundColor,
          img: s.backgroundImage,
          shadow: s.boxShadow,
        };
      }),
    );
    expect(boxes.length, selector).toBeGreaterThan(0);
    for (const b of boxes) {
      expect(b.widths, selector).toEqual(["0px", "0px", "0px", "0px"]);
      expect(b.bg, selector).toBe("rgba(0, 0, 0, 0)");
      expect(b.img, selector).toBe("none");
      expect(b.shadow, selector).toBe("none");
    }
  }
});
test("no dashed or dotted border or outline on the Signature screen (R1.2)", async ({ page }) => {
  await openSample(page, /signature case/i);
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const s = getComputedStyle(el);
      for (const v of [s.borderTopStyle, s.borderRightStyle, s.borderBottomStyle, s.borderLeftStyle, s.outlineStyle]) {
        if (v === "dashed" || v === "dotted") out.push(`${el.tagName}.${el.className}`);
      }
    }
    return out;
  });
  expect(bad).toEqual([]);
});
for (const [name, label] of [
  [/clean meal/i, "approved"],
  [/signature case/i, "partially approved"],
  [/outside the trip window/i, "rejected"],
] as const) {
  test(`result block has no dashed outline or border for ${label} (R1.4)`, async ({ page }) => {
    await openSample(page, name);
    const r = await page.$eval(".xr-doctor .xr-result", (el) => {
      const s = getComputedStyle(el);
      return {
        outline: s.outlineStyle,
        borders: [s.borderTopStyle, s.borderRightStyle, s.borderBottomStyle, s.borderLeftStyle],
      };
    });
    expect(r.outline).not.toBe("dashed");
    for (const b of r.borders) expect(b).not.toBe("dashed");
  });
}
