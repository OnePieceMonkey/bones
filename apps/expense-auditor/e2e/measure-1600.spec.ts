import { expect, test, type Page } from "@playwright/test";
import { stageGeometry } from "../../../packages/xray-ui/src/__tests__/helpers/stageGeometry";

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
  for (const selector of [".xr-cpanel-plaque", ".xr-doctor-title", ".xr-mark-tag"]) {
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

// visual-polish-2 task 4.1 and checkpoint 5 verdict: white tilted paper, 65-70 percent of the film width, on a
// blue-grey film that fills the panel (R4.1 to R4.4, R4.11).
test("paper is white, tilted, on a blue-grey film with two clips (R4.1, R4.2, R4.4)", async ({ page }) => {
  await openSample(page, /signature case/i);
  const m = await page.evaluate(() => {
    const doc = document.querySelector(".xr-doc")!;
    const paper = document.querySelector(".xr-doc-paper")!;
    const d = doc.getBoundingClientRect();
    const ps = getComputedStyle(paper);
    const mat = new DOMMatrixReadOnly(ps.transform);
    const angle = (Math.atan2(mat.b, mat.a) * 180) / Math.PI;
    const filmBg = getComputedStyle(doc, "::before").backgroundImage;
    const rgbs = [...filmBg.matchAll(/rgb\((\d+), (\d+), (\d+)\)/g)].map((x) => [Number(x[1]), Number(x[2]), Number(x[3])]);
    const avg = [0, 1, 2].map((i) => rgbs.reduce((s, c) => s + c[i]!, 0) / rgbs.length);
    const clips = [...document.querySelectorAll(".xr-doc .xr-clip")].map((c) => {
      const r = c.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    });
    return { bg: ps.backgroundColor, angle, film: { left: d.left, right: d.right, top: d.top, bottom: d.bottom }, avg, clips };
  });
  const channels = (m.bg.match(/\d+/g) ?? []).slice(0, 3).map(Number);
  for (const c of channels) expect(c, `paper colour ${m.bg}`).toBeGreaterThanOrEqual(235);
  expect(Math.abs(m.angle)).toBeGreaterThanOrEqual(1);
  expect(Math.abs(m.angle)).toBeLessThanOrEqual(4);
  expect(m.avg[2]! - m.avg[0]!, "film blue minus red").toBeGreaterThanOrEqual(10);
  expect(m.clips).toHaveLength(2);
  for (const c of m.clips) {
    expect(c.left, "clip inside film").toBeGreaterThanOrEqual(m.film.left);
    expect(c.right, "clip inside film").toBeLessThanOrEqual(m.film.right);
    expect(c.top, "clip touches film top edge").toBeLessThanOrEqual(m.film.top + 6);
    expect(c.bottom, "clip touches film top edge").toBeGreaterThan(m.film.top);
  }
});
for (const size of SIZES) {
  test(`film fills the panel and the paper is 65-70 percent of it with 24 px film around at ${size.width}x${size.height} (R4.3)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.getByRole("button", { name: /signature case/i }).click();
    await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
    const m = await page.evaluate(() => {
      const doc = document.querySelector(".xr-doc") as HTMLElement;
      const paper = document.querySelector(".xr-doc-paper") as HTMLElement;
      const cell = doc.getBoundingClientRect();
      const pr = paper.getBoundingClientRect(); // rotated bounds: the strictest margins
      const filmH = parseFloat(getComputedStyle(doc, "::before").height);
      const filmW = parseFloat(getComputedStyle(doc, "::before").width);
      return {
        panelH: cell.height,
        filmH,
        filmW,
        ratio: paper.offsetWidth / filmW,
        left: pr.left - cell.left,
        right: cell.right - pr.right,
        below: cell.bottom - pr.bottom,
      };
    });
    expect(Math.abs(m.filmH - m.panelH), "film height equals panel height").toBeLessThanOrEqual(1);
    expect(m.ratio).toBeGreaterThanOrEqual(0.65);
    expect(m.ratio).toBeLessThanOrEqual(0.7);
    expect(m.left, "film left of paper").toBeGreaterThanOrEqual(24);
    expect(m.right, "film right of paper").toBeGreaterThanOrEqual(24);
    expect(m.below, "film below paper").toBeGreaterThanOrEqual(24);
  });
}
for (const size of SIZES) {
  test(`document panel stays inside the lightbox, off stage and controls at ${size.width}x${size.height} (R4.11)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.getByRole("button", { name: /signature case/i }).click();
    await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
    const r = await page.evaluate(() => {
      const box = (s: string) => {
        const b = document.querySelector(s)!.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
      };
      return { doc: box(".xr-doc"), box: box(".xr-viewport"), stage: box(".xr-shell-stagecell"), ctrl: box(".xr-cpanel") };
    });
    const overlap = (a: typeof r.doc, b: typeof r.doc) =>
      a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    expect(r.doc.left).toBeGreaterThanOrEqual(r.box.left - 0.5);
    expect(r.doc.right).toBeLessThanOrEqual(r.box.right + 0.5);
    expect(r.doc.top).toBeGreaterThanOrEqual(r.box.top - 0.5);
    expect(r.doc.bottom).toBeLessThanOrEqual(r.box.bottom + 0.5);
    expect(overlap(r.doc, r.stage), "doc vs stage").toBe(false);
    expect(overlap(r.doc, r.ctrl), "doc vs controls").toBe(false);
  });
}

// visual-polish-2 task 4.2 and checkpoint 5 verdict: near-invisible underline marks that hug the text (R1.1, R4.5 to R4.8).
test("marks are nearly invisible at rest, hug the text, and turn full cyan with a label on hover (R4.6 to R4.8)", async ({ page }) => {
  await openSample(page, /signature case/i);
  const read = () =>
    page.evaluate(() => {
      const text = document.querySelector(".xr-doc .xr-mark-text") as HTMLElement;
      const tag = text.querySelector(".xr-mark-tag") as HTMLElement;
      const s = getComputedStyle(text);
      const ts = getComputedStyle(tag);
      // Width of the text itself, without the absolutely positioned label.
      const range = document.createRange();
      const node = Array.from(text.childNodes).find((n) => n.nodeType === Node.TEXT_NODE)!;
      range.selectNodeContents(node);
      const alpha = /rgba\([^)]*,\s*([0-9.]+)\)/.exec(s.borderBottomColor);
      return {
        textW: range.getBoundingClientRect().width,
        markW: text.getBoundingClientRect().width,
        lineW: (text.parentElement as HTMLElement).getBoundingClientRect().width,
        bottom: s.borderBottomWidth,
        color: s.borderBottomColor,
        alpha: alpha ? Number(alpha[1]) : 1,
        sides: [s.borderTopWidth, s.borderLeftWidth, s.borderRightWidth],
        bg: s.backgroundColor,
        tagOpacity: Number(ts.opacity),
        tagVisibility: ts.visibility,
        tagDisplay: ts.display,
        tagBox: tag.getBoundingClientRect().width,
      };
    });
  await expect(page.locator(".xr-doc .xr-mark-tag").first()).toBeAttached();
  const rest = await read();
  expect(Math.abs(rest.markW - rest.textW), "mark width within 2 px of text width").toBeLessThanOrEqual(2);
  expect(rest.markW, "mark is narrower than its line").toBeLessThan(rest.lineW);
  expect(rest.bottom).toBe("1px");
  expect(rest.alpha).toBeGreaterThanOrEqual(0.3);
  expect(rest.alpha).toBeLessThanOrEqual(0.4);
  expect(rest.sides).toEqual(["0px", "0px", "0px"]);
  expect(rest.bg).toBe("rgba(0, 0, 0, 0)");
  expect(rest.tagOpacity).toBe(0);
  expect(rest.tagVisibility).toBe("visible");
  expect(rest.tagDisplay).not.toBe("none");
  // Hover on the marked text: full cyan, glow, label shown.
  await page.locator(".xr-doc .xr-mark-text").first().hover();
  await expect.poll(async () => (await read()).tagOpacity).toBe(1);
  const hov = await read();
  expect(hov.color).toBe("rgb(61, 232, 255)");
  expect(hov.alpha).toBe(1);
  expect(hov.tagBox).toBeGreaterThan(0);
  await page.mouse.move(2, 2);
  await expect.poll(async () => (await read()).tagOpacity).toBe(0);
  expect((await read()).alpha).toBeLessThanOrEqual(0.4);
  // Focus on a linked hotspot highlights the mark; no new tab stops in the document.
  const before = await page.locator(".xr-doc [tabindex], .xr-doc button, .xr-doc a").count();
  await page.getByRole("button", { name: /^Line-item match, rule line-item-cap/ }).focus();
  await expect.poll(async () => page.$$eval('.xr-doc .xr-mark-tag[data-highlighted="true"]', (e) => e.length)).toBeGreaterThan(0);
  const shown = await page.$eval('.xr-doc .xr-mark--line[data-highlighted="true"]', (line) => {
    const text = line.querySelector(".xr-mark-text") as HTMLElement;
    const tag = text.querySelector(".xr-mark-tag") as HTMLElement;
    const s = getComputedStyle(text);
    const t = getComputedStyle(tag);
    return { o: Number(t.opacity), b: t.borderTopWidth, bg: t.backgroundColor, sh: t.boxShadow, color: s.borderBottomColor, glow: s.boxShadow !== "none" };
  });
  expect(shown).toEqual({ o: 1, b: "0px", bg: "rgba(0, 0, 0, 0)", sh: "none", color: "rgb(61, 232, 255)", glow: true });
  expect(await page.locator(".xr-doc [tabindex], .xr-doc button, .xr-doc a").count()).toBe(before);
});
test("scan line is red, thin, centred on the total row and spans the paper (R4.9)", async ({ page }) => {
  await openSample(page, /signature case/i);
  const m = await page.evaluate(() => {
    const scan = document.querySelector(".xr-doc .xr-scan")!;
    const s = getComputedStyle(scan);
    // Layout sizes: the paper tilt would inflate bounding rectangles.
    const el = scan as HTMLElement;
    const row = el.parentElement as HTMLElement;
    const paper = (document.querySelector(".xr-doc-paper") as HTMLElement).offsetWidth;
    return { bg: s.backgroundColor, h: el.offsetHeight, cy: el.offsetTop + el.offsetHeight / 2, rowCy: row.offsetHeight / 2, w: el.offsetWidth, paper, anim: s.animationName };
  });
  expect(m.bg).toBe("rgb(255, 122, 122)");
  expect(m.h).toBeGreaterThanOrEqual(1);
  expect(m.h).toBeLessThanOrEqual(3);
  expect(Math.abs(m.cy - m.rowCy)).toBeLessThanOrEqual(6);
  expect(m.w).toBeGreaterThanOrEqual(0.9 * m.paper);
  expect(m.anim).toBe("none");
});

// checkpoint 5 verdict: the whole receipt, including the TOTAL row with its red scan line, is visible at rest without
// scrolling inside the paper (1600x900, 1440x900).
for (const size of SIZES.slice(0, 2)) {
  test(`scan line is fully visible on the paper and the paper does not scroll at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.getByRole("button", { name: /signature case/i }).click();
    await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
    const m = await page.evaluate(() => {
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      const scroll = document.querySelector(".xr-doc-scroll") as HTMLElement;
      const scan = document.querySelector(".xr-doc .xr-scan")!;
      return {
        scan: box(scan),
        visible: box(scroll),
        vw: window.innerWidth,
        vh: window.innerHeight,
        scrollHeight: scroll.scrollHeight,
        clientHeight: scroll.clientHeight,
        scrollTop: scroll.scrollTop,
        pageScroll: document.documentElement.scrollTop + document.body.scrollTop,
        fontPx: parseFloat(getComputedStyle(document.querySelector(".xr-doc .xr-film-text")!).fontSize),
      };
    });
    expect(m.scrollHeight, "paper content height").toBeLessThanOrEqual(m.clientHeight);
    expect(m.scrollTop).toBe(0);
    expect(m.pageScroll).toBe(0);
    expect(m.scan.left, "scan inside paper").toBeGreaterThanOrEqual(m.visible.left - 1);
    expect(m.scan.right).toBeLessThanOrEqual(m.visible.right + 1);
    expect(m.scan.top).toBeGreaterThanOrEqual(m.visible.top);
    expect(m.scan.bottom).toBeLessThanOrEqual(m.visible.bottom);
    expect(m.scan.left).toBeGreaterThanOrEqual(0);
    expect(m.scan.right).toBeLessThanOrEqual(m.vw);
    expect(m.scan.top).toBeGreaterThanOrEqual(0);
    expect(m.scan.bottom).toBeLessThanOrEqual(m.vh);
    expect(m.fontPx).toBeGreaterThanOrEqual(11);
  });
}
test("at 1280x720 the paper either fits or shows the scan line on first render", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.getByRole("button", { name: /signature case/i }).click();
  await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
  const m = await page.evaluate(() => {
    const scroll = document.querySelector(".xr-doc-scroll") as HTMLElement;
    const s = document.querySelector(".xr-doc .xr-scan")!.getBoundingClientRect();
    const v = scroll.getBoundingClientRect();
    return { top: s.top - v.top, bottom: v.bottom - s.bottom, pageScroll: document.documentElement.scrollTop };
  });
  expect(m.top).toBeGreaterThanOrEqual(0);
  expect(m.bottom).toBeGreaterThanOrEqual(0);
  expect(m.pageScroll).toBe(0);
});
// visual-polish-2 task 6.3: one steel panel with a notch, in the four-column shell grid (R5.1).
test("control panel is one rounded steel surface about 36 % of the lightbox wide (R5.1)", async ({ page }) => {
  await openSample(page, /signature case/i);
  const m = await page.evaluate(() => {
    const panel = document.querySelector(".xr-cpanel")!;
    const box = document.querySelector(".xr-viewport")!.getBoundingClientRect();
    const r = panel.getBoundingClientRect();
    const s = getComputedStyle(panel);
    return {
      radiusTopRight: parseFloat(s.borderTopRightRadius),
      right: r.right,
      expected: box.left + 0.36 * box.width,
      image: s.backgroundImage,
      cols: getComputedStyle(document.querySelector(".xr-viewport")!).gridTemplateColumns.split(" ").length,
    };
  });
  expect(m.radiusTopRight).toBeGreaterThan(0);
  expect(Math.abs(m.right - m.expected)).toBeLessThanOrEqual(2);
  expect(m.image).toContain("brushed-steel");
  expect(m.cols).toBe(4);
});

// visual-polish-2 task 6.4: amber lamp above the toggle lever (R5.8).
test("the lamp sits above the lever and is amber when on", async ({ page }) => {
  await openSample(page, /signature case/i);
  const m = await page.evaluate(() => {
    const r = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
    const lamp = r(".xr-ptoggle .xr-plamp");
    const lever = r(".xr-ptoggle .xr-ptoggle-lever");
    const sw = document.querySelector(".xr-ptoggle")!;
    const label = r(".xr-cpanel-item--toggle .xr-cpanel-plaque");
    return {
      lampBottom: lamp.bottom,
      leverTop: lever.top,
      lampCx: lamp.left + lamp.width / 2,
      leverCx: lever.left + lever.width / 2,
      lampW: lamp.width,
      leverW: lever.width,
      leverBottom: lever.bottom,
      labelTop: label.top,
      lit: document.querySelector(".xr-ptoggle .xr-plamp")!.getAttribute("data-lit"),
      filter: getComputedStyle(document.querySelector(".xr-ptoggle .xr-plamp")!).filter,
      checked: sw.getAttribute("aria-checked"),
      role: sw.getAttribute("role"),
    };
  });
  expect(m.role).toBe("switch");
  expect(m.checked).toBe("true");
  expect(m.lit).toBe("true");
  expect(m.lampBottom).toBeLessThanOrEqual(m.leverTop + 1);
  expect(Math.abs(m.lampCx - m.leverCx)).toBeLessThanOrEqual(2);
  expect(m.lampW).toBeGreaterThan(0);
  expect(m.lampW).toBeLessThan(m.leverW);
  expect(m.labelTop).toBeGreaterThanOrEqual(m.leverBottom);
  expect(m.filter).toContain("drop-shadow");
  expect(m.filter).toMatch(/rgba?\(\s*2[0-9]{2},\s*1[0-9]{2},\s*\d+/); // amber glow colour
});

// visual-polish-2 task 6.5: rectangular SVG VU meter (R5.5, R5.6, R5.7).
test("the meter is a rectangle with a red zone and its needle moves by transform only", async ({ page }) => {
  await openSample(page, /signature case/i);
  const m = await page.evaluate(() => {
    const root = document.querySelector(".xr-pmeter")!;
    const rs = getComputedStyle(root);
    const box = root.getBoundingClientRect();
    const needle = document.querySelector(".xr-pmeter-needle")!;
    const ns = getComputedStyle(needle);
    const bezel = document.querySelector(".xr-pmeter-bezel")!.getBoundingClientRect();
    return {
      role: root.getAttribute("role"),
      now: root.getAttribute("aria-valuenow"),
      radius: parseFloat(rs.borderTopLeftRadius),
      w: box.width,
      h: box.height,
      bezelRatio: bezel.width / bezel.height,
      hasImg: root.querySelector("img") !== null,
      zoneStroke: getComputedStyle(document.querySelector(".xr-pmeter-zone")!).stroke,
      numbers: [...root.querySelectorAll(".xr-pmeter-num")].map((e) => e.textContent),
      angle: needle.getAttribute("data-angle"),
      transform: ns.transform,
      animatedProps: ns.animationName,
    };
  });
  expect(m.role).toBe("meter");
  expect(m.now).not.toBeNull();
  expect(m.radius).toBeGreaterThan(0);
  expect(m.radius).toBeLessThan(m.h / 2); // below 50 % of the height: a rounded rectangle, not a disc
  expect(m.w).toBeGreaterThan(m.h * 1.2);
  expect(m.bezelRatio).toBeGreaterThan(1.2);
  expect(m.hasImg).toBe(false);
  expect(m.zoneStroke).toMatch(/rgb\(179, 38, 30\)/);
  expect(m.numbers).toEqual(["0", "25", "50", "75", "100"]);
  // Reduced motion: no animation, the needle shows its final angle through transform only.
  expect(m.animatedProps).toBe("none");
  expect(m.transform).not.toBe("none");
  const src = await page.evaluate(() => {
    const css = [...document.styleSheets].flatMap((s) => [...s.cssRules]).map((r) => r.cssText).join("\n");
    const rule = css.match(/@keyframes xr-needle-swing\s*\{[\s\S]*?\}\s*\}/)?.[0] ?? "";
    return rule;
  });
  const props = [...src.matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1]).filter((p) => p !== "from" && p !== "to");
  expect([...new Set(props)]).toEqual(["transform"]);
});

// visual-polish-2 task 6.6: large knob with engraved labels (R5.2, R5.3, R5.9, R5.11).
// Old dial: 79.2 u (99 px at 1600x900). New dial: 144.8 u (181 px at 1600x900).
for (const size of SIZES) {
  test(`knob dial is 1.8 to 2.2 times the old 79 u dial and the panel fits at ${size.width}x${size.height} (R5.2, R5.11)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("button", { name: /signature case/i }).click();
    await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
    const m = await page.evaluate(() => {
      const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      // --xr-u is a calc() expression; resolve it through a probe element.
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;visibility:hidden;width:calc(100 * var(--xr-u))";
      document.querySelector(".xr-shell")!.appendChild(probe);
      const u = probe.getBoundingClientRect().width / 100;
      probe.remove();
      const dial = document.querySelector<HTMLElement>(".xr-pknob-dial")!;
      const panel = rect(".xr-cpanel");
      const box = rect(".xr-viewport");
      const doc = rect(".xr-doc");
      const doctor = rect(".xr-doctor");
      const items = [...document.querySelectorAll(".xr-cpanel-item")].map((i) => i.getBoundingClientRect());
      const plaques = [...document.querySelectorAll(".xr-cpanel-item")].map((item) => {
        const p = item.querySelector(".xr-cpanel-plaque")!.getBoundingClientRect();
        const c = item.querySelector(".xr-pknob, .xr-pmeter, .xr-ptoggle")!.getBoundingClientRect();
        return {
          dx: Math.abs(p.left + p.width / 2 - (c.left + c.width / 2)),
          dy: Math.max(0, p.top - c.bottom, c.top - p.bottom),
          shadow: getComputedStyle(item.querySelector(".xr-cpanel-plaque")!).textShadow,
        };
      });
      const labels = [...document.querySelectorAll(".xr-pknob-label")].map((l) => {
        const s = getComputedStyle(l);
        return {
          text: l.textContent,
          border: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
          bg: s.backgroundColor,
          active: l.getAttribute("data-active"),
          color: s.color,
        };
      });
      return {
        u,
        dial: dial.offsetWidth,
        panel: { l: panel.left, r: panel.right, t: panel.top, b: panel.bottom },
        box: { l: box.left, r: box.right, t: box.top, b: box.bottom },
        docBottom: doc.bottom,
        doctorLeft: doctor.left,
        itemsRight: Math.max(...items.map((i) => i.right)),
        itemsLeft: Math.min(...items.map((i) => i.left)),
        plaques,
        labels,
        scrollH: document.documentElement.scrollHeight,
        scrollW: document.documentElement.scrollWidth,
      };
    });
    const ratio = m.dial / (79 * m.u);
    expect(ratio).toBeGreaterThanOrEqual(1.8);
    expect(ratio).toBeLessThanOrEqual(2.2);
    for (const p of m.plaques) {
      expect(p.dx).toBeLessThanOrEqual(8);
      expect(p.dy).toBeLessThanOrEqual(40);
      expect(p.shadow).toContain("rgba(255, 255, 255");
    }
    expect(m.labels.map((l) => l.text)).toEqual(["v1", "v2", "v3"]);
    for (const l of m.labels) {
      expect(l.border).toEqual(["0px", "0px", "0px", "0px"]);
      expect(l.bg).toBe("rgba(0, 0, 0, 0)");
    }
    const active = m.labels.filter((l) => l.active === "true");
    const inactive = m.labels.filter((l) => l.active !== "true");
    expect(active).toHaveLength(1);
    for (const l of inactive) expect(l.color).not.toBe(active[0]!.color);
    // Whole panel inside the lightbox, clear of the document and doctor panels, controls inside the panel, no page scroll.
    expect(m.panel.l).toBeGreaterThanOrEqual(m.box.l - 15 * m.u);
    expect(m.panel.b).toBeLessThanOrEqual(m.box.b + 15 * m.u);
    expect(m.panel.r).toBeLessThanOrEqual(m.doctorLeft);
    expect(m.itemsRight).toBeLessThanOrEqual(m.panel.r);
    expect(m.itemsLeft).toBeGreaterThanOrEqual(m.panel.l);
    expect(m.docBottom).toBeLessThanOrEqual(m.panel.t + 1);
    expect(m.scrollH).toBeLessThanOrEqual(size.height);
    expect(m.scrollW).toBeLessThanOrEqual(size.width);
  });
}

// visual-polish-2 task 7.2: phone panel with teal bubbles, thin bar and pill buttons (R6.1 to R6.9).
test("phone panel: pill notch, big avatar, round bubbles, thin bar, pill buttons with icons (R6)", async ({ page }) => {
  await openSample(page, /signature case/i);
  const m = await page.evaluate(() => {
    const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
    const bar = document.querySelector(".xr-progress")!;
    const bs = getComputedStyle(bar);
    const bubbles = [...document.querySelectorAll(".xr-doctor .xr-bubble")].map((b) => {
      const s = getComputedStyle(b);
      return { radius: parseFloat(s.borderTopLeftRadius), overflow: s.overflow, height: s.height, clipped: b.scrollHeight > b.clientHeight + 1 };
    });
    const buttons = [...document.querySelectorAll(".xr-footer-btn")].map((b) => {
      const r = b.getBoundingClientRect();
      return { h: r.height, radius: parseFloat(getComputedStyle(b).borderTopLeftRadius), icon: b.querySelector("svg[aria-hidden='true']") !== null };
    });
    return {
      notch: rect(".xr-doctor-notch").width,
      avatar: rect(".xr-doctor-avatar").width,
      bubbles,
      barH: bar.getBoundingClientRect().height,
      barBorder: [bs.borderTopWidth, bs.borderRightWidth, bs.borderBottomWidth, bs.borderLeftWidth],
      barStyle: bs.borderTopStyle + bs.outlineStyle,
      line: document.querySelector(".xr-result-line")!.textContent,
      buttons,
      bodyOverflowY: getComputedStyle(document.querySelector(".xr-doctor-body")!).overflowY,
    };
  });
  expect(m.notch).toBeGreaterThanOrEqual(60);
  expect(m.notch).toBeLessThanOrEqual(140);
  expect(m.avatar).toBeGreaterThanOrEqual(40);
  expect(m.bubbles.length).toBeGreaterThan(0);
  for (const b of m.bubbles) {
    expect(b.radius).toBeGreaterThanOrEqual(12);
    expect(b.overflow).toBe("visible");
    expect(b.clipped).toBe(false);
  }
  expect(m.barH).toBeGreaterThanOrEqual(2);
  expect(m.barH).toBeLessThanOrEqual(6);
  expect(m.barBorder).toEqual(["0px", "0px", "0px", "0px"]);
  expect(m.barStyle).not.toMatch(/dashed|dotted/);
  expect(m.line?.trim()).toBe("PARTIALLY APPROVED $41.50");
  expect(m.buttons).toHaveLength(2);
  for (const b of m.buttons) {
    expect(b.h).toBeGreaterThanOrEqual(44);
    expect(b.radius).toBeGreaterThanOrEqual(b.h / 2);
    expect(b.icon).toBe(true);
  }
  expect(m.bodyOverflowY).toBe("auto");
});

for (const size of SIZES) {
  test(`chat body scrolls inside its box and the page does not at ${size.width}x${size.height} (R6.9)`, async ({ page }) => {
    await openSample(page, /signature case/i);
    await page.setViewportSize(size);
    const d = await page.evaluate(() => {
      const body = document.querySelector(".xr-doctor-body")!;
      const doc = document.documentElement;
      const panel = document.querySelector(".xr-doctor")!.getBoundingClientRect();
      const footer = document.querySelector(".xr-result-footer")!.getBoundingClientRect();
      return {
        bodyClient: body.clientHeight,
        footerInside: footer.bottom <= panel.bottom + 1,
        buttonsFit: [...document.querySelectorAll(".xr-footer-btn")].every((b) => b.scrollWidth <= b.clientWidth),
        pageX: doc.scrollWidth - doc.clientWidth,
        pageY: doc.scrollHeight - doc.clientHeight,
      };
    });
    expect(d.bodyClient).toBeGreaterThan(0);
    expect(d.footerInside).toBe(true);
    expect(d.buttonsFit, "button text fits on one line").toBe(true);
    expect(d.pageX).toBeLessThanOrEqual(0);
    expect(d.pageY).toBeLessThanOrEqual(0);
  });
}

// Checkpoint 8 verdict (R5.2, R5.5, R5.9): meter as tall as the dial and centred on it, 16 px steel below, one label baseline, numbers >= 11 px.
for (const size of SIZES) {
  test(`meter matches the dial height, is centred on the knob and keeps steel below at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("button", { name: /signature case/i }).click();
    await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
    const m = await page.evaluate(() => {
      const r = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      // The dial is rotated, so its client rect is a bounding box; use the unrotated size and the knob root for the centre.
      const dialEl = document.querySelector<HTMLElement>(".xr-pknob-dial")!;
      const knob = r(".xr-pknob");
      const dial = { height: dialEl.offsetHeight, top: knob.top + (knob.height - dialEl.offsetHeight) / 2 };
      const meter = r(".xr-pmeter");
      const panel = r(".xr-cpanel");
      const plaqueBottom = (cls: string) => r(`.xr-cpanel-item--${cls} .xr-cpanel-plaque`).bottom;
      const svg = r(".xr-pmeter-svg");
      const nums = [...document.querySelectorAll<SVGTextElement>(".xr-pmeter-num")].map(
        (n) => parseFloat(getComputedStyle(n).fontSize) * (svg.width / 200),
      );
      return {
        dialH: dial.height,
        meterH: meter.height,
        dialCy: dial.top + dial.height / 2,
        meterCy: meter.top + meter.height / 2,
        steelBelow: panel.bottom - meter.bottom,
        baselineDelta: Math.abs(plaqueBottom("knob") - plaqueBottom("meter")),
        minNum: Math.min(...nums),
        scrollH: document.documentElement.scrollHeight,
        inside: meter.left >= panel.left && meter.right <= panel.right && meter.top >= panel.top,
      };
    });
    expect(Math.abs(m.meterH - m.dialH) / m.dialH).toBeLessThanOrEqual(0.15);
    expect(Math.abs(m.meterCy - m.dialCy)).toBeLessThanOrEqual(4);
    expect(m.steelBelow).toBeGreaterThanOrEqual(16);
    expect(m.baselineDelta).toBeLessThanOrEqual(2);
    expect(m.minNum).toBeGreaterThanOrEqual(11);
    expect(m.inside).toBe(true);
    expect(m.scrollH).toBeLessThanOrEqual(size.height);
  });
}

// Checkpoint 8 verdict (R5.8): silver metal toggle lever, CSS and SVG only, tilted by transform.
for (const size of SIZES) {
  test(`toggle is a chrome base with a tilting lever and no image at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("button", { name: /signature case/i }).click();
    await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
    const read = () =>
      page.evaluate(() => {
        const lever = document.querySelector(".xr-ptoggle-lever")!;
        const arm = lever.querySelector(".xr-ptoggle-arm")!;
        return {
          imgs: lever.querySelectorAll("img").length,
          baseImage: getComputedStyle(lever.querySelector(".xr-ptoggle-base")!).backgroundImage,
          hasPolygon: lever.querySelector("polygon") !== null,
          hasBall: lever.querySelector("circle") !== null,
          transform: getComputedStyle(arm).transform,
          checked: document.querySelector(".xr-ptoggle")!.getAttribute("aria-checked"),
          lampBottom: document.querySelector(".xr-ptoggle .xr-plamp")!.getBoundingClientRect().bottom,
          leverTop: lever.getBoundingClientRect().top,
          labelTop: document.querySelector(".xr-cpanel-item--toggle .xr-cpanel-plaque")!.getBoundingClientRect().top,
          leverBottom: lever.getBoundingClientRect().bottom,
        };
      });
    const on = await read();
    await page.getByRole("switch", { name: "X-RAY" }).click();
    const off = await read();
    expect(on.checked).toBe("true");
    expect(off.checked).toBe("false");
    expect(on.imgs).toBe(0);
    expect(on.baseImage).toContain("conic-gradient");
    expect(on.hasPolygon && on.hasBall).toBe(true);
    expect(on.transform).not.toBe(off.transform);
    expect(on.lampBottom).toBeLessThanOrEqual(on.leverTop + 1);
    expect(on.labelTop).toBeGreaterThanOrEqual(on.leverBottom);
  });
}

// Checkpoint 8 verdict (R5.3): v1, v2, v3 on a tight arc <= 20 px from the dial with ticks; RULE VERSION above the arc.
// knob.webp art radius is 204/512 of the image (alpha bounding box 52..460).
const KNOB_ART = 204 / 512;
for (const size of SIZES) {
  test(`knob labels sit within 20 px of the dial edge with ticks, RULE VERSION above v2 at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("button", { name: /signature case/i }).click();
    await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
    const m = await page.evaluate((art) => {
      const knob = document.querySelector(".xr-pknob")!.getBoundingClientRect();
      const dialEl = document.querySelector<HTMLElement>(".xr-pknob-dial")!;
      const cx = knob.left + knob.width / 2;
      const cy = knob.top + knob.height / 2;
      const edge = dialEl.offsetWidth * art;
      const labels = [...document.querySelectorAll(".xr-pknob-label")].map((l) => {
        const r = l.getBoundingClientRect();
        const lx = r.left + r.width / 2;
        const ly = r.top + r.height / 2;
        return { text: l.textContent, lx, ly, gap: Math.hypot(lx - cx, ly - cy) - edge, top: r.top, bottom: r.bottom };
      });
      const plaque = document.querySelector(".xr-cpanel-item--knob .xr-cpanel-plaque")!.getBoundingClientRect();
      const panel = document.querySelector(".xr-cpanel")!.getBoundingClientRect();
      return {
        labels,
        cx,
        cy,
        ticks: document.querySelectorAll(".xr-pknob-ticks line").length,
        plaqueBottom: plaque.bottom,
        plaqueTop: plaque.top,
        panelTop: panel.top,
        role: document.querySelector(".xr-pknob")!.getAttribute("role"),
        scrollH: document.documentElement.scrollHeight,
      };
    }, KNOB_ART);
    const [v1, v2, v3] = m.labels;
    expect(m.labels.map((l) => l.text)).toEqual(["v1", "v2", "v3"]);
    for (const l of m.labels) {
      expect(l.gap).toBeGreaterThan(0);
      expect(l.gap).toBeLessThanOrEqual(20);
    }
    expect(v1!.lx).toBeLessThan(m.cx);
    expect(v1!.ly).toBeGreaterThan(m.cy);
    expect(v3!.lx).toBeGreaterThan(m.cx);
    expect(v3!.ly).toBeGreaterThan(m.cy);
    expect(Math.abs(v2!.lx - m.cx)).toBeLessThanOrEqual(2);
    expect(v2!.ly).toBeLessThan(m.cy);
    expect(m.ticks).toBe(3);
    expect(m.role).toBe("slider");
    expect(m.plaqueBottom).toBeLessThan(v2!.top); // RULE VERSION is above v2 with a gap
    expect(m.plaqueTop).toBeGreaterThanOrEqual(m.panelTop);
    expect(m.scrollH).toBeLessThanOrEqual(size.height);
  });
}

// visual-polish-2 task 9.1: the ECG starts at the left-most fractured hotspot (R3.6, R3.7, R3.8).
test("ECG band starts at the left-most fractured hotspot and runs to the stage edge (R3.6, R3.8)", async ({ page }) => {
  await openSample(page, /signature case/i);
  const m = await page.evaluate(() => {
    const centres = Array.from(document.querySelectorAll('.xr-hotspot[data-state="fractured"]')).map((el) => {
      const r = el.getBoundingClientRect();
      return r.left + r.width / 2;
    });
    const band = document.querySelector(".xr-ecg-band")!.getBoundingClientRect();
    const photo = document.querySelector(".xr-photo")!.getBoundingClientRect();
    const spike = getComputedStyle(document.querySelector(".xr-ecg-spike")!).stroke;
    const line = getComputedStyle(document.querySelector(".xr-ecg-line")!).stroke;
    const root = getComputedStyle(document.documentElement);
    return { left: Math.min(...centres), count: centres.length, bandLeft: band.left, bandRight: band.right, photoRight: photo.right, spike, line, red: root.getPropertyValue("--xr-red").trim(), cyan: root.getPropertyValue("--xr-cyan").trim() };
  });
  expect(m.count).toBeGreaterThan(0);
  expect(Math.abs(m.bandLeft - m.left)).toBeLessThanOrEqual(8);
  expect(Math.abs(m.bandRight - m.photoRight)).toBeLessThanOrEqual(1);
  const rgb = (hex: string) => {
    const n = parseInt(hex.replace("#", ""), 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
  };
  expect(m.spike).toBe(rgb(m.red));
  expect(m.line).toBe(rgb(m.cyan));
});
test("ECG band starts at the photo centre when nothing is fractured (R3.7)", async ({ page }) => {
  await openSample(page, /clean meal/i);
  const m = await page.evaluate(() => {
    const band = document.querySelector(".xr-ecg-band")!.getBoundingClientRect();
    const photo = document.querySelector(".xr-photo")!.getBoundingClientRect();
    return { fractured: document.querySelectorAll('.xr-hotspot[data-state="fractured"]').length, bandLeft: band.left, centre: photo.left + photo.width / 2 };
  });
  expect(m.fractured).toBe(0);
  expect(Math.abs(m.bandLeft - m.centre)).toBeLessThanOrEqual(8);
});

// visual-polish-2 task 9.2: soft glow hotspots (R3.9, R3.10, R3.11, R3.12).
test("hotspots are soft glows: no border, round, radial gradient, red and cyan tokens (R3.9, R3.11)", async ({ page }) => {
  await openSample(page, /signature case/i);
  const m = await page.evaluate(() => {
    const read = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const s = getComputedStyle(el);
      return { border: s.borderTopWidth, radius: s.borderTopLeftRadius, bg: s.backgroundImage, filter: s.filter, shadow: s.boxShadow, events: s.pointerEvents, core: s.getPropertyValue("--xr-hs-core").trim() };
    };
    const root = getComputedStyle(document.documentElement);
    return {
      rings: Array.from(document.querySelectorAll(".xr-hs-ring")).map((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { border: s.borderTopWidth, radius: s.borderTopLeftRadius, bg: s.backgroundImage, w: r.width, h: r.height };
      }),
      fractured: read(".xr-hs-ring--fractured"),
      passed: read(".xr-hs-ring--applied-no-change"),
      red: root.getPropertyValue("--xr-red-glow").trim(),
      cyan: root.getPropertyValue("--xr-cyan-glow").trim(),
    };
  });
  expect(m.rings.length).toBeGreaterThan(0);
  for (const r of m.rings) {
    expect(r.border).toBe("0px");
    expect(r.radius).toBe("50%");
    expect(r.bg).toContain("radial-gradient");
  }
  for (const k of [m.fractured, m.passed]) {
    expect(k).not.toBeNull();
    expect(k!.filter).toContain("blur");
    expect(k!.shadow).toBe("none");
    expect(k!.events).toBe("none");
  }
  expect(m.fractured!.core).toBe(m.red);
  expect(m.passed!.core).toBe(m.cyan);
  expect(m.fractured!.bg).toContain("rgba(255, 90, 90");
  expect(m.passed!.bg).toContain("rgba(61, 232, 255");
});
test("focused hotspot keeps a 3 px outline, a 24 px target and the rule box line (R3.10, R3.12)", async ({ page }) => {
  await openSample(page, /signature case/i);
  const btn = page.locator('.xr-hotspot[data-state="fractured"] button.xr-bone-btn').first();
  await page.keyboard.press("Tab");
  await btn.focus();
  const m = await btn.evaluate((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { focused: document.activeElement === el, outline: parseFloat(s.outlineWidth), style: s.outlineStyle, w: r.width, h: r.height };
  });
  const f = m;
  expect(f.focused).toBe(true);
  expect(m.w).toBeGreaterThanOrEqual(24);
  expect(m.h).toBeGreaterThanOrEqual(24);
  expect(f.style).toBe("solid");
  expect(f.outline).toBeGreaterThanOrEqual(3);
  await expect(page.locator(".xr-rulebox").first()).toBeVisible();
  await expect(page.locator(".xr-rb-line").first()).toBeAttached();
});

// visual-polish-2 task 9.3: larger skeleton anchored to the stage bottom (R3.5, R10.4).
test("skeleton fills at least 90 % of the stage height, is centred and sits on the stage bottom (R3.5)", async ({ page }) => {
  await openSample(page, /signature case/i);
  const m = await page.evaluate(() => {
    const photo = document.querySelector(".xr-photo")!.getBoundingClientRect();
    const stage = document.querySelector(".xr-shell-stagecell")!.getBoundingClientRect();
    return { photo: { l: photo.left, r: photo.right, t: photo.top, b: photo.bottom, w: photo.width, h: photo.height }, stage: { l: stage.left, r: stage.right, t: stage.top, b: stage.bottom, w: stage.width, h: stage.height } };
  });
  expect(m.photo.h / m.stage.h).toBeGreaterThanOrEqual(0.9);
  expect(Math.abs((m.photo.l + m.photo.r) / 2 - (m.stage.l + m.stage.r) / 2)).toBeLessThanOrEqual(0.02 * m.stage.w);
  expect(Math.abs(m.photo.b - m.stage.b)).toBeLessThanOrEqual(1);
});
for (const size of [{ width: 1600, height: 900 }, { width: 1280, height: 720 }]) {
  test(`the stage geometry model matches the real rectangles within 2 px at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.getByRole("button", { name: /signature case/i }).click();
    await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
    const m = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const stage = r(".xr-shell-stagecell");
      const photo = r(".xr-photo");
      const panel = r(".xr-cpanel");
      return { stageW: stage.width, stageH: stage.height, stageL: stage.left, photoW: photo.width, photoH: photo.height, photoTop: photo.top - stage.top, panelRight: panel.right };
    });
    const g = stageGeometry(size.width, size.height);
    expect(Math.abs(m.stageW - g.stage.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.stageH - g.stage.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.photoW - g.photoW)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.photoH - g.photoH)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.photoTop - g.photoTop)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.panelRight - g.panelRight)).toBeLessThanOrEqual(2);
  });
}
for (const size of SIZES) {
  test(`receipt and control panel stay fully visible with the larger skeleton at ${size.width}x${size.height} (R10.4)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.getByRole("button", { name: /signature case/i }).click();
    await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
    const m = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      return { doc: r(".xr-doc"), ctrl: r(".xr-cpanel"), vw: window.innerWidth, vh: window.innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight };
    });
    for (const b of [m.doc, m.ctrl]) {
      expect(b.left).toBeGreaterThanOrEqual(-0.5);
      expect(b.top).toBeGreaterThanOrEqual(-0.5);
      expect(b.right).toBeLessThanOrEqual(m.vw + 0.5);
      expect(b.bottom).toBeLessThanOrEqual(m.vh + 0.5);
    }
    expect(m.sw).toBeLessThanOrEqual(m.vw);
    expect(m.sh).toBeLessThanOrEqual(m.vh);
  });
}

// visual-polish-2 task 9.4: glass card at the top centre with compact rows (R3.1 to R3.3, R10.4).
for (const size of SIZES) {
  test(`glass card sits at the top centre above the ribs at ${size.width}x${size.height} (R3.1, R3.2, R3.3)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.getByRole("button", { name: /signature case/i }).click();
    await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
    const m = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const stage = r(".xr-shell-stagecell");
      const photo = r(".xr-photo");
      const glass = r(".xr-glass");
      const others = [".xr-doc", ".xr-doctor", ".xr-cpanel", ".xr-header"].map((s) => ({ s, b: r(s) }));
      const body = document.querySelector(".xr-glass-body")!;
      const rows = Array.from(document.querySelectorAll(".xr-glass .xr-field")).map((f) => {
        const dt = f.querySelector("dt")!.getBoundingClientRect();
        const dd = f.querySelector("dd")!.getBoundingClientRect();
        const rr = f.getBoundingClientRect();
        return { top: rr.top, bottom: rr.bottom, h: rr.height, gap: dd.left - dt.right };
      });
      const bodyRect = body.getBoundingClientRect();
      const cracks = document.querySelector(".xr-glass .xr-cracks")!.getBoundingClientRect();
      return {
        stage: { l: stage.left, w: stage.width },
        photo: { l: photo.left, t: photo.top, w: photo.width, h: photo.height },
        glass: { l: glass.left, r: glass.right, t: glass.top, b: glass.bottom, w: glass.width, h: glass.height },
        others: others.map((o) => ({ s: o.s, l: o.b.left, r: o.b.right, t: o.b.top, b: o.b.bottom })),
        rows,
        body: { top: bodyRect.top, bottom: bodyRect.bottom, scrolls: body.scrollHeight > body.clientHeight + 1 },
        cracks: { l: cracks.left, r: cracks.right, t: cracks.top, b: cracks.bottom },
      };
    });
    const photoCentre = m.photo.l + m.photo.w / 2;
    expect(Math.abs((m.glass.l + m.glass.r) / 2 - photoCentre), "card centre vs photo centre").toBeLessThanOrEqual(0.05 * m.stage.w);
    expect(m.glass.b, "card above the rib top").toBeLessThanOrEqual(m.photo.t + 0.22 * m.photo.h + 0.5);
    expect(m.glass.b, "card above 45 % of the photo").toBeLessThanOrEqual(m.photo.t + 0.45 * m.photo.h);
    expect(m.glass.w / m.stage.w).toBeGreaterThanOrEqual(0.35);
    expect(m.glass.w / m.stage.w).toBeLessThanOrEqual(0.55);
    for (const o of m.others) {
      const hit = m.glass.l < o.r - 0.5 && o.l < m.glass.r - 0.5 && m.glass.t < o.b - 0.5 && o.t < m.glass.b - 0.5;
      expect(hit, `card overlaps ${o.s}`).toBe(false);
    }
    // All four fields are present, one row each, and either fully visible or reachable by scrolling inside the card.
    expect(m.rows.length).toBe(4);
    for (const row of m.rows) {
      expect(row.h, "compact row, at most two text lines").toBeLessThan(48);
      expect(row.gap, "label/value gap").toBeGreaterThanOrEqual(4);
      if (!m.body.scrolls) expect(row.bottom, "row inside the card body").toBeLessThanOrEqual(m.body.bottom + 0.5);
    }
    // Cracks cover the full card area.
    expect(m.cracks.l).toBeLessThanOrEqual(m.glass.l + 2);
    expect(m.cracks.r).toBeGreaterThanOrEqual(m.glass.r - 2);
    expect(m.cracks.t).toBeLessThanOrEqual(m.glass.t + 2);
    expect(m.cracks.b).toBeGreaterThanOrEqual(m.glass.b - 2);
    // Semantics.
    await expect(page.getByRole("article", { name: "AI answer" })).toBeVisible();
    await expect(page.getByRole("note").filter({ hasText: "OVERRULED BY RULE" })).toBeVisible();
    const d = await scrollDims(page);
    expect(d.scrollHeight).toBeLessThanOrEqual(d.innerHeight);
    expect(d.scrollWidth).toBeLessThanOrEqual(d.innerWidth);
  });
}

// visual-polish-2 task 9.5, amended by checkpoint 10: the stamp sits in the reserved strip, crosses a crack, covers no text (R3.4).
for (const size of SIZES) {
  test(`stamp sits in the reserved strip, crosses a crack and covers no text at ${size.width}x${size.height} (R3.4)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.getByRole("button", { name: /signature case/i }).click();
    await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
    const m = await page.evaluate(async () => {
      const stamp = document.querySelector(".xr-glass-stamp") as HTMLElement;
      const s = stamp.getBoundingClientRect();
      const g = document.querySelector(".xr-glass")!.getBoundingClientRect();
      const cs = getComputedStyle(stamp);
      const mat = new DOMMatrixReadOnly(cs.transform);
      const ang = Math.atan2(mat.b, mat.a);
      const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const lin = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      const lum = (c: number[]) => 0.2126 * lin(c[0]!) + 0.7152 * lin(c[1]!) + 0.0722 * lin(c[2]!);
      const fg = parse(getComputedStyle(stamp.querySelector(".xr-stamp-title")!).color);
      const bgc = parse(cs.backgroundColor);
      const a = bgc[3] ?? 1;
      const bg = [0, 1, 2].map((i) => bgc[i]! * a + 255 * (1 - a));
      const hi = Math.max(lum(fg), lum(bg));
      const lo = Math.min(lum(fg), lum(bg));
      // The drawn (rotated) shape of the stamp.
      const cx = (s.left + s.right) / 2;
      const cy = (s.top + s.bottom) / 2;
      const hw = stamp.offsetWidth / 2;
      const hh = stamp.offsetHeight / 2;
      const poly = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [
        cx + x! * Math.cos(ang) - y! * Math.sin(ang),
        cy + x! * Math.sin(ang) + y! * Math.cos(ang),
      ]);
      const hits = (r: DOMRect) => {
        const rect = [[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]];
        const axes = [[1, 0], [0, 1], [Math.cos(ang), Math.sin(ang)], [-Math.sin(ang), Math.cos(ang)]];
        for (const [ax, ay] of axes) {
          const pa = poly.map((p) => p[0]! * ax! + p[1]! * ay!);
          const pb = rect.map((p) => p[0]! * ax! + p[1]! * ay!);
          if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
        }
        return true;
      };
      const bodyBox = document.querySelector(".xr-glass-body")!.getBoundingClientRect();
      const texts = Array.from(document.querySelectorAll(".xr-glass .xr-field dt, .xr-glass .xr-field-value, .xr-glass .xr-conf, .xr-glass .xr-badge, .xr-glass .xr-answer-head")).filter((e) => {
        const r = e.getBoundingClientRect();
        return r.bottom <= bodyBox.bottom + 0.5 && r.top >= bodyBox.top - 0.5; // rows scrolled out of the card are not painted
      });
      const covered = texts.filter((e) => hits(e.getBoundingClientRect())).map((e) => (e.textContent ?? "").slice(0, 30));
      const lastRow = bodyBox;
      // Crack overlap: bright pixels of glass-cracks.webp under the stamp's bounding box (object-fit: cover mapping).
      const img = document.querySelector(".xr-glass .xr-cracks") as HTMLImageElement;
      const ir = img.getBoundingClientRect();
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      const k = Math.max(ir.width / nw, ir.height / nh);
      const ox = (ir.width - nw * k) / 2;
      const oy = (ir.height - nh * k) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = nw;
      canvas.height = nh;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const x0 = Math.max(0, Math.floor((s.left - ir.left - ox) / k));
      const x1 = Math.min(nw, Math.ceil((s.right - ir.left - ox) / k));
      const y0 = Math.max(0, Math.floor((s.top - ir.top - oy) / k));
      const y1 = Math.min(nh, Math.ceil((s.bottom - ir.top - oy) / k));
      const px = ctx.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)).data;
      let bright = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i]! > 128) bright++;
      return {
        s: { l: s.left, r: s.right, t: s.top, b: s.bottom },
        g: { l: g.left, r: g.right, t: g.top, b: g.bottom, w: g.width, h: g.height },
        lastBottom: lastRow.bottom,
        covered,
        bright,
        angle: (ang * 180) / Math.PI,
        contrast: (hi + 0.05) / (lo + 0.05),
      };
    });
    expect(m.s.l, "stamp inside card").toBeGreaterThanOrEqual(m.g.l - 1);
    expect(m.s.r, "stamp inside card").toBeLessThanOrEqual(m.g.r + 1);
    expect(m.s.t, "stamp inside card").toBeGreaterThanOrEqual(m.g.t - 1);
    expect(m.s.b, "stamp inside card").toBeLessThanOrEqual(m.g.b + 1);
    const cx = ((m.s.l + m.s.r) / 2 - m.g.l) / m.g.w;
    expect(cx, "stamp centre in the central 60 percent of the width").toBeGreaterThanOrEqual(0.2);
    expect(cx).toBeLessThanOrEqual(0.8);
    expect(m.s.t, "stamp in the reserved strip below the card body").toBeGreaterThanOrEqual(m.lastBottom - 1);
    expect(m.covered, "stamp shape covers no text").toEqual([]);
    expect(m.bright, "stamp overlaps visible crack pixels").toBeGreaterThanOrEqual(200);
    expect(m.angle).toBeGreaterThanOrEqual(-20);
    expect(m.angle).toBeLessThanOrEqual(-5);
    expect(m.contrast, "stamp text on its own fill").toBeGreaterThanOrEqual(4.5);
  });
}

// visual-polish-2 task 11.1: steel live form and custom file button (R8.1 to R8.4, R8.6).
// The live form renders only when GET /api/extract answers {"live":true}; the answer is mocked, so no real server or provider is called.
async function openLiveStart(page: Page, size = { width: 1600, height: 900 }): Promise<void> {
  await page.route("**/api/extract", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ live: true }) })
      : route.fulfill({ status: 500, body: "mocked: no POST in this test" }),
  );
  await page.setViewportSize(size);
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByLabel("Upload receipt photo")).toBeAttached();
}

test("live form controls: appearance none, sans font, 44 px, hidden native file input (R8.2, R8.4)", async ({ page }) => {
  await openLiveStart(page);
  const sans = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--xr-font-sans").trim());
  const sels = [".xr-form-strip input[type=date] >> nth=0", ".xr-form-strip button[type=submit]", ".xr-file-button"];
  for (const sel of sels) {
    const m = await page.locator(sel).evaluate((el) => {
      const s = getComputedStyle(el);
      return { appearance: s.appearance, family: s.fontFamily, minHeight: parseFloat(s.minHeight), h: el.getBoundingClientRect().height };
    });
    expect(m.appearance, sel).toBe("none");
    expect(m.family, sel).toBe(sans);
    expect(m.minHeight, sel).toBeGreaterThanOrEqual(44);
    expect(m.h, sel).toBeGreaterThanOrEqual(44);
  }
  const input = page.getByLabel("Upload receipt photo");
  const hidden = await input.evaluate((el) => {
    const s = getComputedStyle(el);
    return { display: s.display, visibility: s.visibility, w: el.getBoundingClientRect().width };
  });
  expect(hidden.display).not.toBe("none");
  expect(hidden.visibility).toBe("visible");
  expect(hidden.w).toBeLessThanOrEqual(1);
  await expect(page.locator(".xr-file-name")).toHaveText("Choose a photo");
});

test("live form: file input is focusable by keyboard and the button shows a 3 px ring (R8.2)", async ({ page }) => {
  await openLiveStart(page);
  const input = page.getByLabel("Upload receipt photo");
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    if (await input.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(input).toBeFocused();
  const ring = await page.locator(".xr-file-button").evaluate((el) => {
    const s = getComputedStyle(el);
    return { width: parseFloat(s.outlineWidth), style: s.outlineStyle, color: s.outlineColor, shadow: s.boxShadow };
  });
  expect(ring.style).toBe("solid");
  expect(ring.width).toBeGreaterThanOrEqual(3);
  expect(ring.color).toBe("rgb(255, 255, 255)");
  expect(ring.shadow).toContain("rgb(5, 9, 13)");
});

test("live form: chosen file name appears on the button", async ({ page }) => {
  await openLiveStart(page);
  await page.getByLabel("Upload receipt photo").setInputFiles({ name: "lunch.png", mimeType: "image/png", buffer: Buffer.from("x") });
  await expect(page.locator(".xr-file-name")).toHaveText("lunch.png");
});

for (const size of SIZES) {
  test(`live start screen fits, strip does not overlap the sheets at ${size.width}x${size.height} (R8.6)`, async ({ page }) => {
    await openLiveStart(page, size);
    const d = await scrollDims(page);
    expect(d.scrollHeight, "height").toBeLessThanOrEqual(d.innerHeight);
    expect(d.scrollWidth, "width").toBeLessThanOrEqual(d.innerWidth);
    const boxes = await page.evaluate(() => {
      const strip = document.querySelector(".xr-form-strip")!.getBoundingClientRect();
      const sheets = Array.from(document.querySelectorAll(".xr-start-row .xr-sheet")).map((e) => e.getBoundingClientRect());
      return { strip: { top: strip.top, bottom: strip.bottom, left: strip.left, right: strip.right }, sheetBottom: Math.max(...sheets.map((r) => r.bottom)) };
    });
    expect(boxes.strip.top, "strip below sheets").toBeGreaterThanOrEqual(boxes.sheetBottom);
    expect(boxes.strip.bottom).toBeLessThanOrEqual(size.height);
    expect(boxes.strip.left).toBeGreaterThanOrEqual(0);
    expect(boxes.strip.right).toBeLessThanOrEqual(size.width);
    if (size.width === 1600) await page.screenshot({ path: "/tmp/live-start-1600.png" });
  });
}

// visual-polish-2 task 11.2: the busy status must not overlap the live form (`.app-live-form ~ .app-status` bottom offset).
// The extract POST is held open by a mocked route (no real API); the status is read while it is pending.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
for (const size of SIZES) {
  test(`busy status does not overlap the live form at ${size.width}x${size.height}`, async ({ page }) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/extract", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ live: true }) });
        return;
      }
      await held;
      await route.fulfill({ status: 500, body: "mocked: released" });
    });
    await page.setViewportSize(size);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.getByLabel("Upload receipt photo").setInputFiles({ name: "lunch.png", mimeType: "image/png", buffer: PNG_1X1 });
    await page.getByRole("button", { name: "Read receipt" }).click();
    const status = page.getByRole("status").filter({ hasText: "Reading receipt" });
    await expect(status).toBeVisible();
    const m = await page.evaluate(() => {
      const st = Array.from(document.querySelectorAll("[role=status]")).find((e) => e.textContent?.includes("Reading receipt"))!.getBoundingClientRect();
      const strip = document.querySelector(".xr-form-strip")!.getBoundingClientRect();
      const sheets = Array.from(document.querySelectorAll(".xr-start-row .xr-sheet")).map((e) => e.getBoundingClientRect());
      return {
        st: { t: st.top, b: st.bottom, l: st.left, r: st.right },
        strip: { t: strip.top, b: strip.bottom, l: strip.left, r: strip.right },
        sheetBottom: Math.max(...sheets.map((r) => r.bottom)),
        innerHeight: window.innerHeight,
      };
    });
    const overlap = m.st.l < m.strip.r && m.st.r > m.strip.l && m.st.t < m.strip.b && m.st.b > m.strip.t;
    expect(overlap, `status ${JSON.stringify(m.st)} vs strip ${JSON.stringify(m.strip)}`).toBe(false);
    expect(m.st.b, "status above the strip").toBeLessThanOrEqual(m.strip.t);
    expect(m.st.t, "status below the sheets").toBeGreaterThanOrEqual(m.sheetBottom);
    const d = await scrollDims(page);
    expect(d.scrollHeight, "height").toBeLessThanOrEqual(d.innerHeight);
    if (size.width === 1600) await page.screenshot({ path: "/tmp/busy-live-1600.png" });
    release();
  });
}

// visual-polish-2 checkpoint 12 verdict: start cards are film sheets with white paper thumbnails (R8.9, R8.10).
for (const size of SIZES) {
  test(`start cards: paper thumbnails tilted -3..3, 3-5 mono lines, no border, no dashed at ${size.width}x${size.height} (R8.9)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".xr-start-row .xr-sheet")).toHaveCount(3);
    const cards = await page.$$eval(".xr-start-row .xr-sheet", (els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        const paper = el.querySelector(".xr-sheet-paper")!;
        const m = new DOMMatrix(getComputedStyle(paper).transform);
        const lines = Array.from(paper.querySelectorAll(".xr-sheet-line"));
        const mono = getComputedStyle(document.documentElement).getPropertyValue("--xr-font-mono").trim();
        return {
          borders: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
          styles: [s.borderTopStyle, s.outlineStyle],
          radius: parseFloat(s.borderTopLeftRadius),
          tilt: Math.atan2(m.b, m.a) * (180 / Math.PI),
          paperBg: getComputedStyle(paper).backgroundColor,
          lineCount: lines.length,
          lineFonts: lines.map((l) => getComputedStyle(l).fontFamily),
          mono,
          lineText: lines.map((l) => l.textContent),
          ariaHidden: paper.getAttribute("aria-hidden"),
        };
      }),
    );
    for (const c of cards) {
      expect(c.borders, "border widths").toEqual(["0px", "0px", "0px", "0px"]);
      expect(c.styles.join(" ")).not.toMatch(/dashed|dotted/);
      expect(c.radius, "rounded corners").toBeGreaterThanOrEqual(8);
      expect(c.tilt).toBeGreaterThanOrEqual(-3.01);
      expect(c.tilt).toBeLessThanOrEqual(3.01);
      expect(c.paperBg, "paper is white").toBe("rgb(247, 246, 241)");
      expect(c.lineCount).toBeGreaterThanOrEqual(3);
      expect(c.lineCount).toBeLessThanOrEqual(5);
      for (const f of c.lineFonts) expect(f).toBe(c.mono);
      expect(c.ariaHidden).toBe("true");
    }
    expect(new Set(cards.map((c) => c.tilt.toFixed(2))).size, "tilts differ").toBeGreaterThan(1);
    expect(cards[0]!.lineText.join("|")).toContain("HARBOR GRILL");
    expect(cards[0]!.lineText.join("|").toLowerCase()).not.toMatch(/approved|rejected|capped|deduct/);
  });
}
test("start cards lift 4 px and glow on hover and keyboard focus; transitions are none under reduced motion (R8.10)", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const card = page.getByRole("button", { name: /clean meal/i });
  const top = async () => (await card.boundingBox())!.y;
  const glow = () => card.evaluate((el) => getComputedStyle(el, "::after").opacity);
  const rest = await top();
  expect(await glow()).toBe("0");
  await card.hover();
  expect(rest - (await top()), "hover lift").toBeCloseTo(4, 0);
  expect(await glow()).toBe("1");
  expect(await card.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
  await page.screenshot({ path: "/tmp/start-hover-1600.png" });
  await page.mouse.move(5, 5);
  expect(await top()).toBeCloseTo(rest, 0);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: /signature case/i }).focus();
  await page.keyboard.press("Tab");
  await expect(card).toBeFocused();
  expect(rest - (await top()), "focus lift").toBeCloseTo(4, 0);
  expect(await glow()).toBe("1");
  const ring = await card.evaluate((el) => {
    const s = getComputedStyle(el);
    return { w: parseFloat(s.outlineWidth), style: s.outlineStyle, color: s.outlineColor };
  });
  expect(ring.w).toBeGreaterThanOrEqual(3);
  expect(ring.style).toBe("solid");
  expect(ring.color).toBe("rgb(255, 255, 255)");
});

// visual-polish-2 checkpoint 12 verdict: with the live form hidden the headline and the cards are one block centred in the stage (R8.11).
for (const size of SIZES) {
  test(`start block is vertically centred in the stage when the form is hidden at ${size.width}x${size.height} (R8.11)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".xr-start-row .xr-sheet")).toHaveCount(3);
    const m = await page.evaluate(() => {
      const stage = document.querySelector(".xr-viewport")!.getBoundingClientRect();
      const head = document.querySelector(".xr-start-head")!.getBoundingClientRect();
      const row = document.querySelector(".xr-start-row")!.getBoundingClientRect();
      const top = Math.min(head.top, row.top);
      const bottom = Math.max(head.bottom, row.bottom);
      return { stageCentre: (stage.top + stage.bottom) / 2, blockCentre: (top + bottom) / 2, headBottom: head.bottom, rowTop: row.top };
    });
    expect(Math.abs(m.blockCentre - m.stageCentre), JSON.stringify(m)).toBeLessThanOrEqual(24);
    expect(m.rowTop, "cards below the headline").toBeGreaterThanOrEqual(m.headBottom);
    const d = await scrollDims(page);
    expect(d.scrollHeight).toBeLessThanOrEqual(d.innerHeight);
  });
}

// visual-polish-2 checkpoint 12 verdict: glass card spacing, at least 12 px under the title and 6 px between rows (R3.3).
for (const size of SIZES) {
  test(`glass card keeps 12 px under the title and 6 px between rows, rows stay inside at ${size.width}x${size.height} (R3.3)`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.getByRole("button", { name: /signature case/i }).click();
    await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
    const m = await page.evaluate(() => {
      const head = document.querySelector(".xr-glass .xr-answer-head")!.getBoundingClientRect();
      const rows = Array.from(document.querySelectorAll(".xr-glass .xr-field")).map((f) => f.getBoundingClientRect());
      const body = document.querySelector(".xr-glass-body")!;
      const glass = document.querySelector(".xr-glass")!.getBoundingClientRect();
      const b = body.getBoundingClientRect();
      return {
        headToFirst: rows[0]!.top - head.bottom,
        betweenRows: rows.slice(1).map((r, i) => r.top - rows[i]!.bottom),
        rowCount: rows.length,
        bodyScrolls: body.scrollHeight > body.clientHeight + 1,
        lastRowInside: rows[rows.length - 1]!.bottom <= b.bottom + 0.5,
        glassHeight: glass.height,
        overflowPx: body.scrollHeight - body.clientHeight,
      };
    });
    console.log(`glass ${size.width}x${size.height}: ${JSON.stringify(m)}`);
    // Final review: readable text. Computed font sizes (labels and values at least 14 px, confidence at least 12 px).
    const fonts = await page.evaluate(() => {
      const px = (sel: string) => Array.from(document.querySelectorAll(`.xr-glass .xr-field ${sel}`)).map((e) => parseFloat(getComputedStyle(e).fontSize));
      const photo = document.querySelector(".xr-photo")!.getBoundingClientRect();
      const glass = document.querySelector(".xr-glass")!.getBoundingClientRect();
      // Skull and rib hotspots stay unobstructed: the card bottom stays above the rib line.
      const spots = Array.from(document.querySelectorAll(".xr-hotspot")).map((h) => {
        const r = h.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        return { below: cy >= photo.top + 0.22 * photo.height, covered: !!hit?.closest(".xr-glass") };
      });
      return {
        dt: px("dt"),
        value: px(".xr-field-value"),
        conf: px(".xr-conf"),
        ribGap: photo.top + 0.22 * photo.height - glass.bottom,
        spots: spots.length,
        coveredBelowRibs: spots.filter((x) => x.below && x.covered).length,
        coveredAbove: spots.filter((x) => !x.below && x.covered).length,
      };
    });
    console.log(`glass fonts ${size.width}x${size.height}: ${JSON.stringify(fonts)}`);
    if (size.width >= 1440) {
      expect(fonts.dt.length).toBe(4);
      for (const f of fonts.dt) expect(f, "label font").toBeGreaterThanOrEqual(14);
      for (const f of fonts.value) expect(f, "value font").toBeGreaterThanOrEqual(14);
      for (const f of fonts.conf) expect(f, "confidence font").toBeGreaterThanOrEqual(12);
      expect(fonts.ribGap, "card bottom above the rib line").toBeGreaterThanOrEqual(-0.5);
      expect(fonts.spots, "hotspots exist").toBeGreaterThan(0);
      expect(fonts.coveredBelowRibs, "no hotspot from the rib line down is under the card").toBe(0);
    }
    expect(m.rowCount).toBe(4);
    expect(m.headToFirst, "title to first row").toBeGreaterThanOrEqual(12 - 0.5);
    for (const g of m.betweenRows) expect(g, "between rows").toBeGreaterThanOrEqual(6 - 0.5);
    // All four rows are visible without scrolling at 1600x900 and 1440x900; at 1280x720 the card scrolls inside (as before).
    if (size.width >= 1440) {
      expect(m.bodyScrolls, "card body scrolls").toBe(false);
      expect(m.lastRowInside, "last row inside").toBe(true);
    }
  });
}

// visual-polish-2 task 13.1: sweeps at three viewports. They cover what no earlier test in this file or in layout.spec.ts
// covers: boxed elements (R1.6), fonts (R2.2 to R2.4, R2.6), keyboard focus (R9.2), roles and decorative marks (R9.1, R9.4).
// Page scroll (R10.1 to R10.3, R10.6) and region layout (R10.4) are asserted by the specs above and by layout.spec.ts.
async function openSignature(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /signature case/i }).click();
  await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
}

const BOXED_ALLOW = [
  ".xr-glass",
  ".xr-rulebox",
  ".xr-doctor",
  ".xr-bubble",
  ".xr-footer-btn",
  ".xr-header",
  ".xr-header-pill",
  ".xr-header-action",
  ".xr-steel",
  ".xr-cpanel",
  ".xr-pmeter",
  ".xr-doc-paper",
  ".xr-doc", // the film is the ::before of .xr-doc
  ".xr-hotspot .xr-bone-btn",
  "img",
];

for (const size of SIZES) {
  test(`boxed-element sweep: only allow-listed elements draw a box on the Signature screen at ${size.width}x${size.height} (R1.6)`, async ({ page }) => {
    await openSignature(page, size);
    const found = await page.evaluate((allow) => {
      const out: string[] = [];
      const visible = (c: string) => {
        const m = /rgba?\(([^)]*)\)/.exec(c);
        if (!m) return false;
        const p = m[1]!.split(",").map((x) => parseFloat(x));
        return (p[3] ?? 1) > 0;
      };
      for (const el of Array.from(document.body.querySelectorAll("*"))) {
        if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue; // SVG shapes are drawings, not boxes
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // R1.6 is about boxes around plain text: an element that owns a non-blank text node. Text-free drawings (screws,
        // clips, glows, the progress bar, the toggle base) and layout containers are not boxes around text.
        const ownsText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "");
        if (!ownsText) continue;
        if (allow.some((sel) => el.matches(sel))) continue;
        const s = getComputedStyle(el);
        const reasons: string[] = [];
        const sides = [
          [s.borderTopWidth, s.borderTopStyle, s.borderTopColor],
          [s.borderRightWidth, s.borderRightStyle, s.borderRightColor],
          [s.borderBottomWidth, s.borderBottomStyle, s.borderBottomColor],
          [s.borderLeftWidth, s.borderLeftStyle, s.borderLeftColor],
        ];
        // A single side line (an underline mark, a divider) is not a rectangle around text: report only 2 or more sides.
        const drawn = sides.filter(([w, st, c]) => parseFloat(w!) > 0 && st !== "none" && st !== "hidden" && visible(c!));
        if (drawn.length >= 2) reasons.push(`border(${drawn.length} sides)`);
        if (visible(s.backgroundColor)) reasons.push(`background-color ${s.backgroundColor}`);
        if (s.backgroundImage !== "none") reasons.push("background-image");
        if (s.boxShadow !== "none") reasons.push("box-shadow");
        if (reasons.length > 0) out.push(`${el.tagName.toLowerCase()}.${String(el.getAttribute("class")).replace(/\s+/g, ".")}: ${reasons.join(", ")}`);
      }
      return out;
    }, BOXED_ALLOW);
    expect(found, "boxed elements outside the allow-list").toEqual([]);
  });
}

for (const size of SIZES) {
  test(`font sweep: serif only on wordmark and headline, mono only in the paper, sans weights 400/500 at ${size.width}x${size.height} (R2.2 to R2.4)`, async ({ page }) => {
    await openSignature(page, size);
    const read = (checkMono: boolean) =>
      page.evaluate((mono) => {
        const bad: string[] = [];
        const label = (el: Element) => `${el.tagName.toLowerCase()}.${String(el.getAttribute("class")).replace(/\s+/g, ".")}`;
        for (const el of Array.from(document.body.querySelectorAll("*"))) {
          if (["SCRIPT", "STYLE"].includes(el.tagName)) continue;
          const box = el.getBoundingClientRect();
          if (box.width === 0 || box.height === 0 || el.closest("dialog:not([open])")) continue; // not rendered
          // The visually hidden h1 is clipped to 1 px and carries no visible type (R7.9).
          if (el.closest(".xr-visually-hidden")) continue;
          // Only elements that own text: a direct, non-blank text node.
          const own = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "");
          if (!own) continue;
          const s = getComputedStyle(el);
          const family = s.fontFamily;
          const isWordmark = el.matches(".xr-wordmark, .xr-wordmark *, .xr-start-title, .xr-start-title *");
          if (/^"?Cormorant SC/i.test(family) && !isWordmark) bad.push(`${label(el)}: serif ${family}`);
          if (mono && /monospace|Menlo|Consolas/i.test(family) && !el.closest(".xr-doc")) bad.push(`${label(el)}: mono ${family}`);
          const w = parseInt(s.fontWeight, 10);
          if (!isWordmark && w !== 400 && w !== 500) bad.push(`${label(el)}: weight ${s.fontWeight}`);
        }
        return bad;
      }, checkMono);
    // R2.3 limits the mono rule to the Signature screen: the start cards show paper thumbnails in mono on purpose (R8.9).
    expect(await read(true), "Signature screen").toEqual([]);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    expect(await read(false), "start screen").toEqual([]);
  });
}

for (const size of SIZES) {
  test(`no request to an external font host on the start and Signature screens at ${size.width}x${size.height} (R2.6)`, async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (!["localhost", "127.0.0.1"].includes(u.hostname) && u.protocol !== "data:" && u.protocol !== "blob:") external.push(r.url());
    });
    await openSignature(page, size);
    expect(external).toEqual([]);
  });
}

for (const size of SIZES) {
  test(`focus sweep: knob, toggle, hotspot, footer buttons and header actions show a 3 px solid outline at ${size.width}x${size.height} (R9.2)`, async ({ page }) => {
    await openSignature(page, size);
    const targets: Array<[string, string]> = [
      ["knob", ".xr-pknob"],
      ["toggle", ".xr-ptoggle"],
      ["hotspot", ".xr-hotspot button.xr-bone-btn"],
      ...Array.from({ length: 2 }, (_, i): [string, string] => [`footer button ${i + 1}`, `.xr-footer-btn >> nth=${i}`]),
      ...Array.from({ length: 2 }, (_, i): [string, string] => [`header action ${i + 1}`, `.xr-header-action >> nth=${i}`]),
    ];
    for (const [name, selector] of targets) {
      const loc = page.locator(selector).first();
      await expect(loc, name).toBeAttached();
      // Real keyboard focus: move through the tab order until the target holds focus.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      let focused = false;
      for (let i = 0; i < 60 && !focused; i += 1) {
        await page.keyboard.press("Tab");
        focused = await loc.evaluate((el) => el === document.activeElement || el.contains(document.activeElement));
      }
      expect(focused, `${name} reachable with Tab`).toBe(true);
      const o = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const s = getComputedStyle(el);
        return { width: parseFloat(s.outlineWidth), style: s.outlineStyle, color: s.outlineColor };
      });
      expect(o.style, `${name} outline style`).toBe("solid");
      expect(o.width, `${name} outline width`).toBeGreaterThanOrEqual(3);
      expect(o.color, `${name} outline colour is visible`).not.toMatch(/rgba\([^)]*,\s*0\)$/);
    }
  });
}

for (const size of SIZES) {
  test(`roles and decorative marks: slider, meter, switch; decorative parts are hidden from assistive technology at ${size.width}x${size.height} (R9.1, R9.4)`, async ({ page }) => {
    await openSignature(page, size);
    await expect(page.getByRole("slider")).toHaveCount(1);
    await expect(page.getByRole("meter")).toHaveCount(1);
    await expect(page.getByRole("switch")).toHaveCount(1);
    const missing = await page.evaluate(() => {
      const hidden = (el: Element) => el.closest('[aria-hidden="true"]') !== null || el.getAttribute("alt") === "";
      const sels = [
        ".xr-doctor-notch",
        ".xr-doctor-home",
        ".xr-doctor-avatar",
        ".xr-pknob-ticks",
        ".xr-clip",
        ".xr-footer-btn svg",
        ".xr-header-action svg",
        ".xr-doc img",
        ".xr-glass img",
        ".xr-photo img",
      ];
      const out: string[] = [];
      for (const sel of sels) for (const el of Array.from(document.querySelectorAll(sel))) if (!hidden(el)) out.push(sel);
      return { out, counts: sels.map((s) => [s, document.querySelectorAll(s).length] as const) };
    });
    expect(missing.out, "decorative elements without aria-hidden or empty alt").toEqual([]);
    // The sweep must not pass by matching nothing.
    for (const [sel, n] of missing.counts) {
      if (!sel.startsWith(".xr-doc img") && !sel.startsWith(".xr-glass img") && !sel.startsWith(".xr-photo img")) expect(n, `${sel} exists`).toBeGreaterThan(0);
    }
  });
}
