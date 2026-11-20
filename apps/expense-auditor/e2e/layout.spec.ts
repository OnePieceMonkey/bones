import { expect, test, type Page } from "@playwright/test";

const SIZES = [
  { width: 1280, height: 720 },
  { width: 1280, height: 1080 },
  { width: 1920, height: 720 },
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1600, height: 900 },
];
const REGIONS = [".xr-doc", ".xr-glass", ".xr-photo", ".xr-doctor", ".xr-cpanel"] as const;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

async function openSignatureCase(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /signature case/i }).click();
  await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
}

/** Measures regions, header and pill in one evaluate call so the result is one consistent snapshot. */
function measure(page: Page) {
  return page.evaluate((regions) => {
    const box = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    return {
      vw: window.innerWidth,
      vh: window.innerHeight,
      regions: Object.fromEntries(regions.map((s) => [s, box(s)])) as Record<string, Box | null>,
      header: box(".xr-header"),
      pill: box(".xr-header-pill"),
      steel: box(".xr-steel"),
    };
  }, [...REGIONS]);
}

type Measured = Awaited<ReturnType<typeof measure>>;

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
}

function checkLayout(m: Measured): void {
  for (const sel of REGIONS) {
    const b = m.regions[sel];
    expect(b, `${sel} exists`).not.toBeNull();
    if (!b) continue;
    expect(b.left, `${sel} left`).toBeGreaterThanOrEqual(-0.5);
    expect(b.top, `${sel} top`).toBeGreaterThanOrEqual(-0.5);
    expect(b.right, `${sel} right`).toBeLessThanOrEqual(m.vw + 0.5);
    expect(b.bottom, `${sel} bottom`).toBeLessThanOrEqual(m.vh + 0.5);
  }
  for (let i = 0; i < REGIONS.length; i += 1) {
    for (let j = i + 1; j < REGIONS.length; j += 1) {
      const a = m.regions[REGIONS[i]!];
      const b = m.regions[REGIONS[j]!];
      // Known exception: the design lays the glass card over the lower left of the photo (shell.css, .xr-shell-stagecell .xr-glass).
      if (REGIONS[i] === ".xr-glass" && REGIONS[j] === ".xr-photo") continue;
      // visual-polish-2 A5: the steel panel may cover the transparent margin of the photo box; the pixel gap is checked below.
      if (REGIONS[i] === ".xr-photo" && REGIONS[j] === ".xr-cpanel") continue;
      if (a && b) expect(overlaps(a, b), `${REGIONS[i]} overlaps ${REGIONS[j]}`).toBe(false);
    }
  }
  // visual-polish-2 R5.11: the panel stays 10 px clear of the left-most opaque skeleton pixel (22.43 % of the photo width).
  const panel = m.regions[".xr-cpanel"];
  const photo = m.regions[".xr-photo"];
  if (panel && photo) {
    expect(panel.right + 10, "cpanel clears the skeleton pixels").toBeLessThanOrEqual(photo.left + 0.2243 * (photo.right - photo.left));
  }
  expect(m.header, "header exists").not.toBeNull();
  expect(m.pill, "pill exists").not.toBeNull();
  if (m.header && m.pill) {
    const pillCentre = (m.pill.left + m.pill.right) / 2;
    const headerCentre = (m.header.left + m.header.right) / 2;
    expect(Math.abs(pillCentre - headerCentre), "pill centre vs header centre").toBeLessThanOrEqual(2);
  }
}

for (const size of SIZES) {
  test(`layout at ${size.width}x${size.height}: regions inside viewport, no overlap, pill centred`, async ({ page }) => {
    await page.setViewportSize(size);
    await openSignatureCase(page);
    checkLayout(await measure(page));
  });
}

test("layout holds within 100 ms after a viewport change", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSignatureCase(page);
  for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 1080 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    const started = Date.now();
    // One animation frame is enough for style and layout recalculation.
    const m = await page.evaluate(
      () =>
        new Promise<{ ms: number }>((resolve) => {
          const t0 = performance.now();
          requestAnimationFrame(() => resolve({ ms: performance.now() - t0 }));
        }),
    );
    checkLayout(await measure(page));
    expect(Date.now() - started, `check after ${size.width}x${size.height}`).toBeLessThan(1000);
    expect(m.ms).toBeLessThan(100);
  }
});

const SCROLL_SIZES = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
];

function scrollDims(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      scrollHeight: root.scrollHeight,
      clientHeight: root.clientHeight,
    };
  });
}

for (const size of SCROLL_SIZES) {
  test(`no page scrollbar on the start screen at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(page.getByRole("button", { name: /signature case/i })).toBeVisible();
    const d = await scrollDims(page);
    expect(d.scrollWidth).toBe(d.clientWidth);
    expect(d.scrollHeight).toBe(d.clientHeight);
  });

  test(`no page scrollbar on the signature case at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openSignatureCase(page);
    const d = await scrollDims(page);
    expect(d.scrollWidth).toBe(d.clientWidth);
    expect(d.scrollHeight).toBe(d.clientHeight);
  });
}

test("statusNote strip fits in the header at 1280x720", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openSignatureCase(page);
  const r = await page.evaluate(() => {
    const brand = document.querySelector(".xr-header-brand");
    const status = document.querySelector(".xr-header-status");
    const pill = document.querySelector(".xr-header-pill");
    if (!brand || !status || !pill) return null;
    const s = status.getBoundingClientRect();
    const b = brand.getBoundingClientRect();
    const p = pill.getBoundingClientRect();
    return {
      statusRight: s.right,
      brandRight: b.right,
      pillLeft: p.left,
      statusScrollWidth: status.scrollWidth,
      statusClientWidth: status.clientWidth,
      brandScrollWidth: brand.scrollWidth,
      brandClientWidth: brand.clientWidth,
      title: status.getAttribute("title"),
    };
  });
  expect(r, "header brand, status and pill exist").not.toBeNull();
  if (!r) return;
  expect(r.statusRight).toBeLessThanOrEqual(r.pillLeft + 0.5);
  expect(r.brandScrollWidth, "brand content is not clipped").toBeLessThanOrEqual(r.brandClientWidth);
});
