import { expect, test, type Page } from "@playwright/test";
// Requirements 14.7, 14.8, 13.7, 21.3, 21.5: no page scroll, no overlap and computed styles at three viewports.
// Runs in project chromium-1600; the other two viewports are set with page.setViewportSize.

const VIEWPORTS = [
  { width: 1600, height: 900 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
] as const;

type Box = { name: string; x: number; y: number; w: number; h: number };

async function openFourSuspects(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.__caseFilesE2E !== undefined);
  await page.evaluate(() => window.__caseFilesE2E!.loadRecordedCase("four-suspects"));
  await expect(page.getByRole("radio", { name: "the widow" })).toBeVisible();
  const xray = page.getByRole("switch", { name: "X-RAY" });
  if ((await xray.getAttribute("aria-checked")) !== "true") await xray.click();
  await expect(page.locator(".xr-ensemble-stage")).toBeVisible();
}

async function expectNoPageScroll(page: Page, label: string): Promise<void> {
  const m = await page.evaluate(() => ({
    sh: document.documentElement.scrollHeight,
    sw: document.documentElement.scrollWidth,
    ih: window.innerHeight,
    iw: window.innerWidth,
    bh: document.body.scrollHeight,
    bw: document.body.scrollWidth,
  }));
  expect.soft(m.sh, `${label}: scrollHeight`).toBeLessThanOrEqual(m.ih);
  expect.soft(m.sw, `${label}: scrollWidth`).toBeLessThanOrEqual(m.iw);
  expect.soft(m.bh, `${label}: body scrollHeight`).toBeLessThanOrEqual(m.ih);
  expect.soft(m.bw, `${label}: body scrollWidth`).toBeLessThanOrEqual(m.iw);
}

const PANELS = [".xr-doc", ".xr-glass", ".xr-ensemble-stage", ".xr-doctor", ".xr-cpanel"] as const;

async function expectPanelsInsideAndApart(page: Page, label: string): Promise<void> {
  const boxes: Box[] = [];
  for (const sel of PANELS) {
    const loc = page.locator(sel);
    await expect(loc, `${label}: ${sel} exists once`).toHaveCount(1);
    const b = await loc.boundingBox();
    expect(b, `${label}: ${sel} has a box`).not.toBeNull();
    boxes.push({ name: sel, x: b!.x, y: b!.y, w: b!.width, h: b!.height });
  }
  const vp = page.viewportSize()!;
  for (const b of boxes) {
    expect.soft(b.x, `${label}: ${b.name} left edge`).toBeGreaterThanOrEqual(-0.5);
    expect.soft(b.y, `${label}: ${b.name} top edge`).toBeGreaterThanOrEqual(-0.5);
    expect.soft(b.x + b.w, `${label}: ${b.name} right edge`).toBeLessThanOrEqual(vp.width + 0.5);
    expect.soft(b.y + b.h, `${label}: ${b.name} bottom edge`).toBeLessThanOrEqual(vp.height + 0.5);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      expect.soft(ox > 0.5 && oy > 0.5, `${label}: ${a.name} overlaps ${b.name} (${ox.toFixed(1)}x${oy.toFixed(1)})`).toBe(false);
    }
  }
}

async function expectContentNotClipped(page: Page, label: string): Promise<void> {
  // Text inside the panels must not be cut off by the panel box, except in the boxes that scroll on purpose (R14.9).
  const clipped = await page.evaluate(() => {
    const out: string[] = [];
    for (const sel of [".xr-glass", ".xr-glass-body", ".xr-ensemble-plate"]) {
      document.querySelectorAll<HTMLElement>(sel).forEach((el, i) => {
        if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
          out.push(`${sel}[${i}] ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`);
        }
      });
    }
    return out;
  });
  expect.soft(clipped, `${label}: clipped content`).toEqual([]);
}

async function expectPlatesOneLine(page: Page, label: string): Promise<void> {
  const heights = await page.locator(".xr-ensemble-plate").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  expect.soft(new Set(heights).size, `${label}: name plates share one height (no wrapped plate), got ${heights.join(",")}`).toBe(1);
  const lines = await page.locator(".xr-ensemble-plate").evaluateAll((els) =>
    els.map((e) => {
      const r = document.createRange();
      r.selectNodeContents(e);
      return new Set(Array.from(r.getClientRects()).map((c) => Math.round(c.top))).size;
    }),
  );
  expect.soft(Math.max(...lines), `${label}: every name plate text is on one line`).toBe(1);
}

async function expectBonesInsideMembers(page: Page, label: string): Promise<void> {
  // R13.7: the skeletons stay inside the stage. Every bone hotspot of a member lies inside that member's box.
  const outside = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>(".xr-ensemble-member").forEach((m, i) => {
      const mb = m.getBoundingClientRect();
      m.querySelectorAll<HTMLElement>(".xr-hotspot").forEach((h, j) => {
        const r = h.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        if (cx < mb.left - 1 || cx > mb.right + 1 || cy < mb.top - 1 || cy > mb.bottom + 1) out.push(`member ${i} hotspot ${j} centre ${cx.toFixed(0)},${cy.toFixed(0)}`);
      });
    });
    return out;
  });
  expect(await page.locator(".xr-ensemble-member .xr-hotspot").count(), `${label}: hotspots exist`).toBeGreaterThan(0);
  expect.soft(outside, `${label}: bone hotspots outside their member`).toEqual([]);
}

async function expectMembers(page: Page, label: string, minWidth: number): Promise<void> {
  const members = page.locator(".xr-ensemble-member");
  await expect(members).toHaveCount(4);
  const boxes: Box[] = [];
  for (let i = 0; i < 4; i++) {
    const b = await members.nth(i).boundingBox();
    expect(b).not.toBeNull();
    boxes.push({ name: `member ${i}`, x: b!.x, y: b!.y, w: b!.width, h: b!.height });
  }
  const stage = (await page.locator(".xr-ensemble-stage").boundingBox())!;
  for (const b of boxes) {
    expect.soft(b.w, `${label}: ${b.name} width`).toBeGreaterThanOrEqual(minWidth);
    expect.soft(b.x, `${label}: ${b.name} inside stage (left)`).toBeGreaterThanOrEqual(stage.x - 0.5);
    expect.soft(b.x + b.w, `${label}: ${b.name} inside stage (right)`).toBeLessThanOrEqual(stage.x + stage.width + 0.5);
    expect.soft(b.y, `${label}: ${b.name} inside stage (top)`).toBeGreaterThanOrEqual(stage.y - 0.5);
    expect.soft(b.y + b.h, `${label}: ${b.name} inside stage (bottom)`).toBeLessThanOrEqual(stage.y + stage.height + 0.5);
  }
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      expect.soft(ox > 0.5 && oy > 0.5, `${label}: ${a.name} overlaps ${b.name}`).toBe(false);
    }
  }
}

async function expectComputedStyles(page: Page, label: string, requireLabels = true): Promise<void> {
  const result = await page.evaluate(() => {
    const dashed: string[] = [];
    const labelBoxes: string[] = [];
    const sides = ["Top", "Right", "Bottom", "Left"] as const;
    const describe = (el: Element) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).replace(/\s+/g, ".")}`;
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const cs = getComputedStyle(el);
      for (const s of sides) {
        const style = cs.getPropertyValue(`border-${s.toLowerCase()}-style`);
        const width = parseFloat(cs.getPropertyValue(`border-${s.toLowerCase()}-width`));
        if ((style === "dashed" || style === "dotted") && width > 0) dashed.push(`${describe(el)} border-${s.toLowerCase()}: ${style}`);
      }
      if ((cs.outlineStyle === "dashed" || cs.outlineStyle === "dotted") && parseFloat(cs.outlineWidth) > 0) {
        dashed.push(`${describe(el)} outline: ${cs.outlineStyle}`);
      }
    }
    for (const el of Array.from(document.querySelectorAll(".xr-cpanel-plaque, .xr-doctor-title"))) {
      const cs = getComputedStyle(el);
      for (const s of sides) {
        const style = cs.getPropertyValue(`border-${s.toLowerCase()}-style`);
        const width = parseFloat(cs.getPropertyValue(`border-${s.toLowerCase()}-width`));
        if (style !== "none" && style !== "hidden" && width > 0) labelBoxes.push(`${describe(el)} border-${s.toLowerCase()} ${style} ${width}px`);
      }
      if (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") labelBoxes.push(`${describe(el)} background-color ${cs.backgroundColor}`);
      if (cs.backgroundImage !== "none") labelBoxes.push(`${describe(el)} background-image ${cs.backgroundImage}`);
      if (cs.boxShadow !== "none") labelBoxes.push(`${describe(el)} box-shadow ${cs.boxShadow}`);
    }
    return { dashed, labelBoxes, labels: document.querySelectorAll(".xr-cpanel-plaque, .xr-doctor-title").length };
  });
  expect.soft(result.dashed, `${label}: dashed or dotted borders and outlines`).toEqual([]);
  expect.soft(result.labelBoxes, `${label}: label elements with a box`).toEqual([]);
  if (requireLabels) expect(result.labels, `${label}: label elements exist`).toBeGreaterThan(0);
}

for (const vp of VIEWPORTS) {
  const tag = `${vp.width}x${vp.height}`;

  test.describe(tag, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(vp);
    });

    test("start screen has no page scroll", async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByRole("button", { name: /midnight greenhouse/i })).toBeVisible();
      await expectNoPageScroll(page, `start ${tag}`);
      const vpSize = page.viewportSize()!;
      const sheets = page.getByRole("button", { name: /suspects/i });
      const n = await sheets.count();
      for (let i = 0; i < n; i++) {
        const b = (await sheets.nth(i).boundingBox())!;
        expect.soft(b.x + b.width, `start ${tag}: sheet ${i} right edge`).toBeLessThanOrEqual(vpSize.width + 0.5);
        expect.soft(b.y + b.height, `start ${tag}: sheet ${i} bottom edge`).toBeLessThanOrEqual(vpSize.height + 0.5);
      }
      await expectComputedStyles(page, `start ${tag}`, false);
    });

    test("case screen with 4 suspects of 5 statements: no scroll, no overlap", async ({ page }) => {
      await openFourSuspects(page);
      const label = `case ${tag}`;
      await expectNoPageScroll(page, label);
      await expectPanelsInsideAndApart(page, label);
      await expectMembers(page, label, 160);
      await expectContentNotClipped(page, label);
      await expectPlatesOneLine(page, label);
      await expectBonesInsideMembers(page, label);
      await expectComputedStyles(page, label);
      // Select each suspect in turn: the document panel changes but the page still does not scroll.
      for (const name of ["the porter", "the widow"]) {
        await page.getByRole("radio", { name }).click();
        await expectNoPageScroll(page, `${label} (${name})`);
        await expectPanelsInsideAndApart(page, `${label} (${name})`);
      }
    });

    test("verdict view: no scroll, no overlap, accused highlighted", async ({ page }) => {
      await openFourSuspects(page);
      await page.getByRole("radio", { name: "the widow" }).click();
      await page.getByRole("button", { name: "Accuse", exact: true }).click();
      await expect(page.locator(".case-banner")).toContainText("CASE CLOSED");
      await expect(page.locator('.xr-ensemble-plate[data-member-id="widow"]')).toHaveAttribute("data-accused", "true");
      const label = `verdict ${tag}`;
      await expectNoPageScroll(page, label);
      await expectPanelsInsideAndApart(page, label);
      await expectMembers(page, label, 160);
      await expectContentNotClipped(page, label);
      await expectPlatesOneLine(page, label);
      await expectBonesInsideMembers(page, label);
      await expectComputedStyles(page, label);
    });

    test("rejected case: the stamp lies inside the cracked Glass_Card", async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole("button", { name: /two candlesticks/i }).click();
      await page.getByRole("radio", { name: "Ada" }).click();
      const glass = page.locator(".xr-glass");
      await expect(glass).toHaveAttribute("data-overruled", "true");
      const stamp = glass.locator(".xr-glass-stamp");
      await expect(stamp).toContainText("OVERRULED BY RULE");
      const g = (await glass.boundingBox())!;
      const s = (await stamp.boundingBox())!;
      expect.soft(s.x, `stamp left ${tag}`).toBeGreaterThanOrEqual(g.x - 1);
      expect.soft(s.y, `stamp top ${tag}`).toBeGreaterThanOrEqual(g.y - 1);
      expect.soft(s.x + s.width, `stamp right ${tag}`).toBeLessThanOrEqual(g.x + g.width + 1);
      expect.soft(s.y + s.height, `stamp bottom ${tag}`).toBeLessThanOrEqual(g.y + g.height + 1);
      const label = `rejected ${tag}`;
      await expectNoPageScroll(page, label);
      await expectContentNotClipped(page, label);
      await expectComputedStyles(page, label);
    });
  });
}
