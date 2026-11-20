import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { contrastRatio, relativeLuminance, blend, hexToRgb, rgbToHex, type Rgb } from "./helpers/contrast";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "..", "styles", "tokens.css"), "utf8");

export const TOKEN_PAIRS: { fg: string; bg: string }[] = [
  { fg: "--xr-text", bg: "--xr-bg-deep" },
  { fg: "--xr-text", bg: "--xr-bg-panel" },
  { fg: "--xr-text-dim", bg: "--xr-bg-panel" },
  { fg: "--xr-text-dim", bg: "--xr-bg-deep" },
  { fg: "--xr-cyan", bg: "--xr-bg-deep" },
  { fg: "--xr-cyan", bg: "--xr-bg-panel" },
  { fg: "--xr-red", bg: "--xr-bg-deep" },
  { fg: "--xr-red", bg: "--xr-bg-panel" },
  { fg: "--xr-text-muted", bg: "--xr-bg-deep" },
  { fg: "--xr-text-on-metal", bg: "--xr-bg-metal-light" },
  { fg: "--xr-text-on-cyan", bg: "--xr-bg-cyan-fill" },
  { fg: "--xr-text-on-paper", bg: "--xr-bg-paper" },
  { fg: "--xr-text-on-plate", bg: "--xr-bg-plate" },
  { fg: "--xr-text-on-red", bg: "--xr-bg-red-fill" },
  { fg: "--xr-text-stamp", bg: "--xr-bg-stamp" },
  { fg: "--xr-text", bg: "--xr-bg-row" },
  { fg: "--xr-text-dim", bg: "--xr-bg-row" },
  { fg: "--xr-text-on-paper", bg: "--xr-bg-row-paper" },
];

function hexOf(name: string): string | undefined {
  const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  return m?.[1];
}

function numberOf(name: string): number | undefined {
  const m = new RegExp(`${name}:\\s*([0-9]*\\.?[0-9]+)\\s*;`).exec(css);
  return m ? Number(m[1]) : undefined;
}

function need(name: string): string {
  const v = hexOf(name);
  if (v === undefined) throw new Error(`missing token ${name}`);
  return v;
}

/** Message format shared by every contrast failure. */
export function failMessage(name: string, ratio: number, required: number): string {
  return `${name}: ${ratio.toFixed(2)} < ${required}`;
}

/** Lightest and darkest pixel of an image by WCAG relative luminance. */
async function extremePixels(file: string, opaqueOnly = false): Promise<{ light: Rgb; dark: Rgb }> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let light: Rgb = [0, 0, 0];
  let dark: Rgb = [255, 255, 255];
  let lMax = -1;
  let lMin = 2;
  for (let i = 0; i < info.width * info.height; i++) {
    const o = i * 4;
    if (opaqueOnly && data[o + 3]! < 255) continue;
    const px: Rgb = [data[o]!, data[o + 1]!, data[o + 2]!];
    const l = relativeLuminance(rgbToHex(px));
    if (l > lMax) { lMax = l; light = px; }
    if (l < lMin) { lMin = l; dark = px; }
  }
  return { light, dark };
}

const assets = join(here, "..", "assets");

/** Average, lightest and darkest pixel of brushed-steel.webp. */
async function scanSteel(): Promise<{ avg: Rgb; light: Rgb; dark: Rgb }> {
  const file = join(assets, "brushed-steel.webp");
  const { light, dark } = await extremePixels(file);
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const sum = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) sum[c]! += data[i * info.channels + c]!;
  return { avg: sum.map((s) => s / n) as unknown as Rgb, light, dark };
}

/** Value of an rgba(r, g, b, a) token as tint and alpha. */
function rgbaOf(name: string): { tint: Rgb; alpha: number } {
  const m = new RegExp(`${name}:\\s*rgba\\(\\s*(\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([0-9.]+)\\s*\\)`).exec(css);
  if (!m) throw new Error(`missing token ${name}`);
  return { tint: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: Number(m[4]) };
}

describe("token contrast", () => {
  it("keeps the 18 original pairs", () => {
    expect(TOKEN_PAIRS).toHaveLength(18);
  });

  it("every pair token exists in tokens.css with a hex value", () => {
    for (const { fg, bg } of TOKEN_PAIRS) {
      expect(hexOf(fg), `missing token ${fg}`).toBeDefined();
      expect(hexOf(bg), `missing token ${bg}`).toBeDefined();
    }
  });

  it.each(TOKEN_PAIRS.map((p) => [p.fg, p.bg, p] as const))(
    "%s on %s has ratio >= 4.5",
    (_fg, _bg, pair) => {
      const ratio = contrastRatio(need(pair.fg), need(pair.bg));
      expect(ratio, failMessage(`${pair.fg} on ${pair.bg}`, ratio, 4.5)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

const NEW_PAIRS: { name: string; fg: string; bg: string }[] = [
  { name: "header", fg: "--xr-text-header", bg: "--xr-bg-header" },
  { name: "film sheet", fg: "--xr-text-on-sheet", bg: "--xr-bg-sheet" },
  { name: "bubble", fg: "--xr-text-bubble", bg: "--xr-bg-bubble" },
  { name: "phone head", fg: "--xr-text-phone-head", bg: "--xr-bg-phone-head" },
  { name: "result footer", fg: "--xr-text-footer", bg: "--xr-bg-footer" },
  { name: "rule box", fg: "--xr-text-rulebox", bg: "--xr-bg-rulebox" },
  { name: "paper document (token)", fg: "--xr-text-paper-doc", bg: "--xr-bg-paper-doc" },
  { name: "live stamp", fg: "--xr-text-stamp-live", bg: "--xr-bg-stamp-live" },
];

const FOCUS_PAIRS: { name: string; fg: string; bg: string }[] = [
  { name: "focus vs focus-contrast", fg: "--xr-focus", bg: "--xr-focus-contrast" },
  ...["--xr-bg-deep", "--xr-bg-panel", "--xr-bg-plate", "--xr-bg-metal-dark"].map((bg) => ({
    name: `focus vs ${bg}`,
    fg: "--xr-focus",
    bg,
  })),
];

// Count of text pairs: 18 original + 9 token pairs above + 2 glass + 1 paper image + 2 start subline = 32.
describe("new surface contrast", () => {
  // The old exact count of 18 became "at least 29" because 11 new surfaces were added.
  it("has at least 35 text pairs", async () => {
    // visual-polish-2 task 1.3 adds 6 text/graphic pairs (pill, stamp, pillbtn, header glass, meter text, meter zone): 29 + 6 = 35.
    const total = TOKEN_PAIRS.length + NEW_PAIRS.length + 2 /* glass */ + 1 /* paper.webp */ + 6 /* NEW_PAIRS_V2 */ + 1 /* steel plaque on steel average */;
    expect(total).toBeGreaterThanOrEqual(35);
  });

  it.each(NEW_PAIRS.map((p) => [p.name, p] as const))("%s >= 4.5", (_n, p) => {
    const ratio = contrastRatio(need(p.fg), need(p.bg));
    expect(ratio, failMessage(p.name, ratio, 4.5)).toBeGreaterThanOrEqual(4.5);
  });

  it("glass text meets 4.5 on the darkest and lightest film backdrop", async () => {
    const alpha = numberOf("--xr-glass-alpha");
    expect(alpha, "missing token --xr-glass-alpha").toBeDefined();
    const tint = hexToRgb(need("--xr-glass-tint"));
    const { light, dark } = await extremePixels(join(assets, "film.webp"));
    for (const [label, px] of [["darkest", dark], ["lightest", light]] as const) {
      const bg = rgbToHex(blend(tint, alpha!, px));
      const ratio = contrastRatio(need("--xr-text-on-glass"), bg);
      expect(ratio, failMessage(`glass on ${label} film pixel`, ratio, 4.5)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("document text meets 4.5 on the paper token and on the token under creases and curl", () => {
    // visual-polish-2 R4.1 supersedes visual-polish R6: the paper is a token colour, no longer paper.webp.
    // Creases and curl darken the paper by at most 12 percent (alpha 0.16 is only in the corner, outside the text).
    const fg = need("--xr-text-paper-doc");
    const bg = hexToRgb(need("--xr-bg-paper-doc"));
    const darkened = rgbToHex(bg.map((c) => c * 0.88) as unknown as Rgb);
    const ratio = Math.min(contrastRatio(fg, need("--xr-bg-paper-doc")), contrastRatio(fg, darkened));
    expect(ratio, failMessage("paper document", ratio, 4.5)).toBeGreaterThanOrEqual(4.5);
  });

  it("start subline meets 4.5 on the darkest and lightest film pixel", async () => {
    const { light, dark } = await extremePixels(join(assets, "film.webp"));
    for (const [label, px] of [["darkest", dark], ["lightest", light]] as const) {
      const ratio = contrastRatio(need("--xr-text-start-sub"), rgbToHex(px));
      expect(ratio, failMessage(`start subline on ${label} film pixel`, ratio, 4.5)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it.each(FOCUS_PAIRS.map((p) => [p.name, p] as const))("%s >= 3", (_n, p) => {
    const ratio = contrastRatio(need(p.fg), need(p.bg));
    expect(ratio, failMessage(p.name, ratio, 3)).toBeGreaterThanOrEqual(3);
  });

  // Feature: visual-polish-2, Property 7: Every text and focus pair meets its ratio
  // **Validates: Requirements 1.5, 4.1, 5.10, 6.3, 7.5, 9.3**
  it("every visual-polish-2 text and focus pair meets its ratio", async () => {
    const film = await extremePixels(join(assets, "film.webp"));
    const steel = await scanSteel();
    const sheen = rgbaOf("--xr-steel-sheen");
    const overSheen = (px: Rgb) => blend(sheen.tint, sheen.alpha, px);

    const pill = rgbaOf("--xr-bg-pill");
    const glass = rgbaOf("--xr-bg-header-glass");
    const stampTint = hexToRgb(need("--xr-bg-stamp-live"));
    const stampAlpha = numberOf("--xr-stamp-alpha")!;
    const deep = hexToRgb(need("--xr-bg-deep"));
    const meterFace = "#e9dcb6";

    const pairs: { name: string; fg: string; bg: string; min: number }[] = [
      { name: "pill text on pill over lightest film", fg: need("--xr-text-pill"), bg: rgbToHex(blend(pill.tint, pill.alpha, film.light)), min: 4.5 },
      { name: "stamp text on stamp over lightest film", fg: need("--xr-text-stamp-live"), bg: rgbToHex(blend(stampTint, stampAlpha, film.light)), min: 4.5 },
      { name: "pillbtn", fg: need("--xr-text-pillbtn"), bg: need("--xr-bg-pillbtn"), min: 4.5 },
      { name: "header text on glass over deep", fg: need("--xr-text-header"), bg: rgbToHex(blend(glass.tint, glass.alpha, deep)), min: 4.5 },
      { name: "meter text on face", fg: need("--xr-text-on-meter"), bg: meterFace, min: 4.5 },
      { name: "meter zone on face (graphic)", fg: need("--xr-meter-zone"), bg: meterFace, min: 3 },
      // visual-polish-2 R5.10 supersedes visual-polish R9: the plaque pair is measured on the bare steel average, not on a plate token.
      { name: "steel label on steel average", fg: need("--xr-text-on-steel"), bg: rgbToHex(steel.avg), min: 4.5 },
      // FOCUS_PAIRS_V2
      { name: "focus-contrast on lightest steel after sheen", fg: need("--xr-focus-contrast"), bg: rgbToHex(overSheen(steel.light)), min: 3 },
      { name: "focus on darkest steel after sheen", fg: need("--xr-focus"), bg: rgbToHex(overSheen(steel.dark)), min: 3 },
    ];
    // Task 3.2: the header and pill pairs above are the ones header.css actually reads.
    const headerCss = readFileSync(join(here, "..", "styles", "header.css"), "utf8");
    for (const token of ["--xr-text-pill", "--xr-bg-pill", "--xr-bg-header-glass", "--xr-text-header"]) {
      expect(headerCss, `header.css reads ${token}`).toContain(`var(${token})`);
    }
    for (const p of pairs) {
      const ratio = contrastRatio(p.fg, p.bg);
      expect(ratio, failMessage(p.name, ratio, p.min)).toBeGreaterThanOrEqual(p.min);
    }
    // Property: for any pair in the list the ratio holds (list is fixed, order must not matter).
    fc.assert(
      fc.property(fc.constantFrom(...pairs), (p) => contrastRatio(p.fg, p.bg) >= p.min),
      { numRuns: 100 },
    );
  });

  it("reports a missing token and a low ratio in the documented format", () => {
    expect(() => need("--xr-does-not-exist")).toThrow("missing token --xr-does-not-exist");
    expect(failMessage("x on y", 2.345, 4.5)).toBe("x on y: 2.35 < 4.5");
  });

  // Feature: visual-polish, Property 19: Contrast pairs meet WCAG
  // **Validates: Requirements 7.8, 8.11, 9.13, 11.7, 18.1, 18.2, 18.3, 6.8**
  it("blend returns channels between tint and backdrop", () => {
    const rgb = fc.tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }));
    fc.assert(
      fc.property(rgb, fc.double({ min: 0, max: 1, noNaN: true }), rgb, (t, a, b) => {
        const out = blend(t, a, b);
        for (let i = 0; i < 3; i++) {
          const lo = Math.min(t[i]!, b[i]!) - 1e-9;
          const hi = Math.max(t[i]!, b[i]!) + 1e-9;
          if (out[i]! < lo || out[i]! > hi) return false;
        }
        return true;
      }),
      { numRuns: 100 },
    );
  });
});
