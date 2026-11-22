import { expect, test, type Page } from "@playwright/test";

const FRACTURED = "button.xr-bone-btn[data-state='fractured']";
const LINE_ITEM = "Line-item match, rule line-item-cap version 1.0.0, fractured";
const ALCOHOL = "Alcohol, rule alcohol-deducting version 1.0.0, fractured";
const MEAL_LIMIT = "Meal limit, rule meal-limit version 1.0.0, applied, no change";

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function skeleton(page: Page) {
  return page.getByRole("group", { name: "Decision skeleton" });
}

/** Stamp box vs value boxes, stacking order of cracks and rows, and row text hygiene. */
async function checkLayout(page: Page, label: string): Promise<void> {
  const stamp = page.getByRole("note").filter({ hasText: "OVERRULED BY RULE" });
  await expect(stamp, `${label}: stamp visible`).toBeVisible();
  const m = await page.evaluate(() => {
    const box = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const stampEl = Array.from(document.querySelectorAll('[role="note"]')).find((n) =>
      (n.textContent ?? "").includes("OVERRULED BY RULE"),
    );
    const glass = document.querySelector(".xr-glass");
    const cracks = glass?.querySelector(".xr-cracks") ?? null;
    const body = glass?.querySelector(".xr-glass-body") ?? null;
    return {
      stamp: stampEl ? box(stampEl) : null,
      glassBox: glass ? box(glass) : null,
      values: Array.from(document.querySelectorAll(".xr-glass .xr-field-value")).map(box),
      cracksZ: cracks ? Number.parseInt(getComputedStyle(cracks).zIndex, 10) : null,
      bodyZ: body ? Number.parseInt(getComputedStyle(body).zIndex, 10) : null,
      rows: Array.from(document.querySelectorAll(".xr-glass .xr-field")).map((f) => ({
        label: f.querySelector("dt")?.textContent ?? "",
        text: f.textContent ?? "",
      })),
    };
  });
  expect(m.stamp, `${label}: stamp box`).not.toBeNull();
  expect(m.values.length, `${label}: AI card has value boxes`).toBeGreaterThan(0);
  // visual-polish-2 R3.3, R3.4: the stamp is drawn across the compact card, so it may cover part of a value; it must not hide one entirely.
  for (const v of m.values) {
    const covered = m.stamp!.left <= v.left && m.stamp!.right >= v.right && m.stamp!.top <= v.top && m.stamp!.bottom >= v.bottom;
    expect(covered, `${label}: stamp hides a value completely`).toBe(false);
  }
  expect(m.glassBox, `${label}: glass box`).not.toBeNull();
  expect(m.stamp!.left, `${label}: stamp inside card`).toBeGreaterThanOrEqual(m.glassBox!.left - 1);
  expect(m.stamp!.right, `${label}: stamp inside card`).toBeLessThanOrEqual(m.glassBox!.right + 1);
  expect(m.stamp!.bottom, `${label}: stamp inside card`).toBeLessThanOrEqual(m.glassBox!.bottom + 1);
  expect(Number.isNaN(m.cracksZ), `${label}: cracks z-index is numeric`).toBe(false);
  expect(m.cracksZ, `${label}: cracks z-index`).not.toBeNull();
  expect(m.cracksZ!, `${label}: cracks below rows`).toBeLessThan(m.bodyZ!);
  expect(m.rows.length).toBeGreaterThan(0);
  for (const r of m.rows) {
    expect(r.text, `${label}: row "${r.label}" has no brace`).not.toContain("{");
    expect(r.text, `${label}: row "${r.label}" has no bracket`).not.toContain("[");
    expect(r.label, `${label}: label "${r.label}" is not camelCase`).not.toMatch(/[a-z][A-Z]/);
  }
  const text = await page.locator("body").innerText();
  expect(text).toContain("$480.00");
  expect(text).toContain("$41.50");
  expect(text).not.toMatch(/\bEUR\b/);
}

/**
 * The glass card is translucent on purpose (backdrop-filter), so alpha 1 is not asserted.
 * Instead: hide the card text, screenshot the card, take the brightest backdrop pixel
 * behind each label and value, and require WCAG AA contrast (4.5:1) for the real text colour.
 */
async function checkGlassReadability(page: Page, label: string): Promise<void> {
  const style = await page.addStyleTag({
    content: ".xr-glass *, .xr-glass-stamp { color: transparent !important; text-shadow: none !important; } .xr-glass-stamp { visibility: hidden !important; }",
  });
  const shot = (await page.screenshot()).toString("base64");
  await style.evaluate((el) => (el as unknown as Element).remove());
  const results = await page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    const scale = bmp.width / window.innerWidth;
    const lin = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = (r: number, g: number, bl: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
    const out: { what: string; maxLum: number }[] = [];
    // Backdrop luminance only; the text colour is read below.
    // visual-polish-2 R3.3: at small sizes the compact card scrolls inside; rows scrolled out of view are not painted on the card, so only visible rows are sampled.
    const glassRect = document.querySelector(".xr-glass-body")!.getBoundingClientRect();
    const inside = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.top >= glassRect.top - 0.5 && r.bottom <= glassRect.bottom + 0.5;
    };
    const targets = Array.from(document.querySelectorAll(".xr-glass .xr-field dt, .xr-glass .xr-field-value, .xr-glass .xr-conf")).filter(inside);
    for (const el of targets) {
      const r = el.getBoundingClientRect();
      const x0 = Math.max(0, Math.floor(r.left * scale));
      const y0 = Math.max(0, Math.floor(r.top * scale));
      const w = Math.max(1, Math.min(bmp.width - x0, Math.ceil(r.width * scale)));
      const h = Math.max(1, Math.min(bmp.height - y0, Math.ceil(r.height * scale)));
      const px = ctx.getImageData(x0, y0, w, h).data;
      let maxL = 0;
      for (let i = 0; i < px.length; i += 4) maxL = Math.max(maxL, lum(px[i]!, px[i + 1]!, px[i + 2]!));
      out.push({ what: `${el.className || el.tagName}:${(el.textContent ?? "").slice(0, 24)}`, maxLum: maxL });
    }
    return out;
  }, shot);
  // Text colours were made transparent for the shot, so read them from a fresh computed style.
  const colours = await page.evaluate(() => {
    const parse = (c: string): [number, number, number] => {
      const m = c.match(/[\d.]+/g)!.map(Number);
      return [m[0]!, m[1]!, m[2]!];
    };
    const lin = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const glassRect = document.querySelector(".xr-glass-body")!.getBoundingClientRect();
    return Array.from(
      document.querySelectorAll(".xr-glass .xr-field dt, .xr-glass .xr-field-value, .xr-glass .xr-conf"),
    ).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= glassRect.top - 0.5 && r.bottom <= glassRect.bottom + 0.5;
    }).map((el) => {
      const [r, g, b] = parse(getComputedStyle(el).color);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    });
  });
  expect(colours.length).toBe(results.length);
  results.forEach((r, i) => {
    const hi = Math.max(colours[i]!, r.maxLum);
    const lo = Math.min(colours[i]!, r.maxLum);
    const contrast = (hi + 0.05) / (lo + 0.05);
    expect(contrast, `${label}: contrast of ${r.what}`).toBeGreaterThanOrEqual(4.5);
  });
}

test("signature flow: decision, replay, override and trace export", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /signature case/i }).click();
  await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });

  // Reduced motion skips the intro: the X-RAY switch is on as soon as the decision shows.
  await expect(page.getByRole("switch", { name: "X-RAY" })).toBeChecked();
  // The title plate is hidden text now; it is the label of the lightbox region.
  await expect(page.getByRole("region", { name: "Expense Auditor - RECORDED" })).toBeAttached();

  const result = page.locator(".xr-result-footer");
  await expect(result.locator(".xr-result-line")).toHaveText("PARTIALLY APPROVED $41.50");

  const fractured = skeleton(page).locator(FRACTURED);
  await expect(fractured).toHaveCount(2);
  await expect(skeleton(page).getByRole("button", { name: LINE_ITEM })).toHaveAttribute("data-state", "fractured");
  await expect(skeleton(page).getByRole("button", { name: ALCOHOL })).toHaveAttribute("data-state", "fractured");
  const meal = skeleton(page).getByRole("button", { name: MEAL_LIMIT });
  await expect(meal).toHaveAttribute("data-state", "passed");
  await expect(meal).toContainText("applied, no change");

  await expect(page.getByRole("note").filter({ hasText: "OVERRULED BY RULE" })).toBeVisible();

  // Layout and readability, at both supported shell sizes.
  for (const size of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    const label = `${size.width}x${size.height}`;
    await checkLayout(page, label);
    await checkGlassReadability(page, label);
  }

  // Replay with v3: ArrowRight twice on the knob.
  const knob = page.getByRole("slider", { name: "RULE VERSION" });
  await knob.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(knob).toHaveAttribute("aria-valuetext", "v3");
  await expect(page.getByText("Replayed with v3")).toBeVisible();
  await expect(result.locator(".xr-result-line")).toHaveText("PARTIALLY APPROVED $41.50");
  await expect(page.getByRole("region", { name: "Expense Auditor - RECORDED" })).toBeAttached();

  // Override.
  await page.getByRole("button", { name: "Human override" }).click();
  const dialog = page.getByRole("dialog", { name: "Overrule decision" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Reviewer name").fill("Dana Reviewer");
  await dialog.getByLabel("Reason").fill("Manager confirmed the alcohol was a client gift.");
  await dialog.getByLabel("New result").selectOption("approved");
  await dialog.getByRole("button", { name: "Save override" }).click();
  await expect(dialog).toBeHidden();

  await expect(result.locator(".xr-result-line")).toContainText("APPROVED");
  await expect(result.locator(".xr-result-line")).not.toContainText("PARTIALLY");
  await expect(result).toContainText("overruled by Dana Reviewer");
  await expect(result).toContainText("Rules decided: PARTIALLY APPROVED");
  await expect(skeleton(page).locator(FRACTURED)).toHaveCount(2);

  // Download the trace.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download trace" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^expense-trace-[0-9a-f]{8}\.json$/);
  const path = await download.path();
  const { readFile } = await import("node:fs/promises");
  const file = JSON.parse(await readFile(path, "utf8")) as {
    format: string;
    trace: { result: string; amountCents: number; decisionId: string };
    overrides: { reviewerName: string; replacementResult: string; decisionId: string }[];
    replayedFrom?: { ruleSetVersion: string };
  };
  expect(file.format).toBeTruthy();
  expect(file.trace.result).toBe("partially_approved");
  expect(file.trace.amountCents).toBe(4150);
  expect(file.overrides).toHaveLength(1);
  expect(file.overrides[0]!.reviewerName).toBe("Dana Reviewer");
  expect(file.overrides[0]!.replacementResult).toBe("approved");
  expect(file.overrides[0]!.decisionId).toBe(file.trace.decisionId);
  expect(file.replayedFrom?.ruleSetVersion).toBe("1.0.0");
});
