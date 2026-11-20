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

// visual-polish-2 task 3.2: framed header, glass pill, ghost actions (R2.6, R2.7, R7.1 to R7.9).
test("header is a framed bar with a muted centred pill and ghost action pills", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["localhost", "127.0.0.1"].includes(u.hostname) && !r.url().startsWith("data:")) external.push(r.url());
  });
  await openSample(page, /signature case/i);
  const m = await page.evaluate(() => {
    const rect = (sel: string) => {
      const r = document.querySelector(sel)!.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const header = document.querySelector(".xr-header")!;
    const pill = document.querySelector(".xr-header-pill")!;
    const alpha = /rgba\([^)]*,\s*([0-9.]+)\)/.exec(getComputedStyle(pill).backgroundColor);
    const actions = Array.from(document.querySelectorAll(".xr-header-action")).map((a) => {
      const s = getComputedStyle(a);
      const r = a.getBoundingClientRect();
      return {
        radius: parseFloat(s.borderTopLeftRadius),
        height: r.height,
        left: r.left,
        right: r.right,
        icon: a.querySelectorAll('svg[aria-hidden="true"]').length,
        bgAlpha: Number(/rgba\([^)]*,\s*([0-9.]+)\)/.exec(s.backgroundColor)?.[1] ?? 1),
      };
    });
    const trip = Array.from(document.querySelectorAll(".xr-visually-hidden")).some((e) => /Trip:/.test(e.textContent ?? ""));
    return {
      vw: window.innerWidth,
      header: rect(".xr-header"),
      headerRadius: parseFloat(getComputedStyle(header).borderTopLeftRadius),
      pill: rect(".xr-header-pill"),
      pillAlpha: Number(alpha?.[1] ?? 1),
      wordmark: rect(".xr-wordmark"),
      tagline: rect(".xr-tagline"),
      actions,
      trip,
      h1: document.querySelectorAll("h1").length,
    };
  });
  expect(m.header.width / m.vw).toBeGreaterThanOrEqual(0.9);
  expect(m.headerRadius).toBeGreaterThanOrEqual(12);
  expect(Math.abs((m.pill.left + m.pill.right) / 2 - (m.header.left + m.header.right) / 2)).toBeLessThanOrEqual(2);
  expect(m.pillAlpha).toBeLessThanOrEqual(0.35);
  expect(m.actions.length).toBeGreaterThanOrEqual(2);
  for (const a of m.actions) {
    expect(a.radius).toBeGreaterThanOrEqual(a.height / 2);
    expect(a.icon).toBe(1);
    expect(a.bgAlpha).toBeLessThanOrEqual(0.1);
  }
  for (let i = 1; i < m.actions.length; i += 1) {
    expect(m.actions[i]!.left - m.actions[i - 1]!.right).toBeGreaterThanOrEqual(8);
  }
  const tagGap = m.tagline.left - m.wordmark.right;
  expect(tagGap).toBeGreaterThanOrEqual(8);
  expect(tagGap).toBeLessThanOrEqual(24);
  expect(m.trip, "trip text in the DOM, hidden").toBe(true);
  expect(m.h1).toBe(1);
  // Visually hidden text is clipped to 1 px, so Playwright still calls it "visible"; check the clip instead.
  const tripBox = await page.locator(".xr-header .xr-visually-hidden", { hasText: "Trip:" }).first().boundingBox();
  expect(tripBox === null || (tripBox.width <= 1 && tripBox.height <= 1), "trip text is clipped to 1 px").toBe(true);
  expect(external, "no external font host").toEqual([]);
});

test("header layout holds when the wordmark font fails to load (R2.7)", async ({ page }) => {
  const boxes = async () =>
    page.evaluate(() =>
      [".xr-header", ".xr-header-pill", ".xr-header-actions"].map((s) => {
        const r = document.querySelector(s)!.getBoundingClientRect();
        return [r.left, r.top, r.width, r.height].map(Math.round);
      }),
    );
  await openSample(page, /signature case/i);
  const withFont = await boxes();
  const p2 = await page.context().newPage();
  await p2.route(/\.woff2/, (r) => r.abort());
  await p2.setViewportSize({ width: 1600, height: 900 });
  await p2.goto("/");
  await p2.getByRole("button", { name: /signature case/i }).click();
  await p2.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
  const without = await p2.evaluate(() =>
    [".xr-header", ".xr-header-pill", ".xr-header-actions"].map((s) => {
      const r = document.querySelector(s)!.getBoundingClientRect();
      return [r.left, r.top, r.width, r.height].map(Math.round);
    }),
  );
  for (let i = 0; i < withFont.length; i += 1) {
    for (let k = 0; k < 4; k += 1) expect(Math.abs(withFont[i]![k]! - without[i]![k]!), `box ${i}/${k}`).toBeLessThanOrEqual(2);
  }
});
