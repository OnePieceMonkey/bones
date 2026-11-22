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
