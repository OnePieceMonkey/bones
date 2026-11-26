import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "../helpers/contrast";

// case-files R16.5, R16.7, R20.5. app.css is layout only; the visual rules live in packages/xray-ui.
// This guard resolves the tokens app.css names, checks that each exists in tokens.css, and checks the colour
// pairs of the elements this app places: ensemble plates (X-ray and flat view), the reason line, the result
// banner and its note, the "Recorded demo case" note on the film sheet, buttons and the override dialog.

const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS = readFileSync(resolve(HERE, "../../../../packages/xray-ui/src/styles/tokens.css"), "utf8");
const APP_CSS = readFileSync(resolve(HERE, "../../src/styles/app.css"), "utf8");

function parseTokens(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out.set(m[1]!, m[2]!.trim());
  return out;
}
const tokens = parseTokens(TOKENS);

function hex(name: string): string {
  const v = tokens.get(name);
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`token ${name} is not a #rrggbb colour: ${v}`);
  return v;
}

/** Blend white over a #rrggbb colour (worst case of the light sheen layers on the film sheet). */
function lighten(h: string, alpha: number): string {
  const c = [1, 3, 5].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - alpha) + 255 * alpha));
  return `#${c.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

type Pair = { readonly fg: string; readonly bg: string; readonly where: string };
type Colours = { readonly fg: string; readonly bg: string };

/** Returns the pairs below `min` (empty when all pass). `resolve` maps a pair to concrete colours. */
export function failingPairs(pairs: readonly Pair[], min: number, resolveColours: (p: Pair) => Colours): string[] {
  return pairs
    .map((p) => {
      const c = resolveColours(p);
      return { p, ratio: contrastRatio(c.fg, c.bg) };
    })
    .filter((r) => r.ratio < min)
    .map((r) => `${r.p.where}: ${r.p.fg} on ${r.p.bg} = ${r.ratio.toFixed(2)} < ${min}`);
}

const byToken = (p: Pair): Colours => ({ fg: hex(p.fg), bg: hex(p.bg) });
// The film sheet carries white sheen layers (alpha 0.06 and 0.03 stacked); check text on the lightened film too.
const SHEET_SHEEN = 0.09;

// Pairs the app adds beyond the xray-ui ones (all at least 4.5:1).
const TEXT_PAIRS: readonly Pair[] = [
  { fg: "--xr-text", bg: "--xr-bg-deep", where: "body text; ensemble plate text and reason line (X-ray on)" },
  { fg: "--xr-cyan", bg: "--xr-bg-deep", where: "ensemble plate frame, selected glow (X-ray on)" },
  { fg: "--xr-red", bg: "--xr-bg-deep", where: "accused plate frame (X-ray on)" },
  { fg: "--xr-text-on-paper", bg: "--xr-bg-paper", where: "flat view: plate text, plate frame, .case-reason, banner and note" },
  { fg: "--xr-bg-red-fill", bg: "--xr-bg-paper", where: "flat view: accused plate frame" },
  { fg: "--xr-text-on-plate", bg: "--xr-bg-plate", where: "result banner (correct) on its plate" },
  { fg: "--xr-text-on-red", bg: "--xr-bg-red-fill", where: "result banner (wrong) on red fill" },
  { fg: "--xr-text", bg: "--xr-bg-panel", where: "override dialog text, banner note on panel" },
  { fg: "--xr-text-dim", bg: "--xr-bg-panel", where: "dim text on panel" },
  { fg: "--xr-text", bg: "--xr-bg-row", where: "override .xr-input text" },
  { fg: "--xr-text-dim", bg: "--xr-bg-row", where: "override .xr-counter" },
  { fg: "--xr-text-on-plate", bg: "--xr-bg-plate", where: ".xr-btn / footer button text (Accuse, Replay, New case)" },
  { fg: "--xr-text-muted", bg: "--xr-bg-plate", where: "disabled Accuse button" },
  { fg: "--xr-text-on-cyan", bg: "--xr-bg-cyan-fill", where: ".xr-btn--primary (Save override)" },
  { fg: "--xr-text-stamp", bg: "--xr-bg-stamp", where: ".xr-error, .xr-field-error" },
  { fg: "--xr-cyan", bg: "--xr-bg-panel", where: ".xr-dialog h2" },
  { fg: "--xr-text-on-sheet", bg: "--xr-bg-film", where: "'Recorded demo case' note on the film sheet" },
  { fg: "--xr-text-on-sheet", bg: "--xr-bg-film-deep", where: "film sheet text (title, description)" },
];

const FOCUS_PAIRS: readonly Pair[] = [
  { fg: "--xr-focus", bg: "--xr-bg-deep", where: "focus ring on the stage and ensemble plates" },
  { fg: "--xr-focus", bg: "--xr-bg-panel", where: "focus ring on panels and dialog" },
  { fg: "--xr-focus", bg: "--xr-bg-plate", where: "focus ring on buttons" },
  { fg: "--xr-focus", bg: "--xr-bg-film", where: "focus ring on film sheets" },
  { fg: "--xr-focus-contrast", bg: "--xr-focus", where: "inner ring against the focus ring" },
];

describe("contrast guard (case-files)", () => {
  it("every var(--...) token named in app.css exists in tokens.css", () => {
    const used = new Set([...APP_CSS.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((m) => m[1]!));
    expect(used.size).toBeGreaterThan(0);
    // --xr-u is a runtime layout unit set by the Shell, with a fallback in app.css.
    const missing = [...used].filter((t) => t !== "--xr-u" && !tokens.has(t));
    expect(missing).toEqual([]);
  });

  it("every colour token app.css uses in a checked pair is covered", () => {
    const colourTokens = [
      ...APP_CSS.matchAll(/(?:^|[;{\s])(?:color|background|border(?:-color)?|outline)\s*:[^;]*var\(\s*(--xr-(?:text|bg)[a-z-]*)/gim),
    ].map((m) => m[1]!);
    const covered = new Set(TEXT_PAIRS.flatMap((p) => [p.fg, p.bg]));
    expect(colourTokens.filter((t) => !covered.has(t))).toEqual([]);
  });

  it("every pair token exists with a #rrggbb value", () => {
    for (const p of [...TEXT_PAIRS, ...FOCUS_PAIRS]) {
      expect(() => hex(p.fg), p.where).not.toThrow();
      expect(() => hex(p.bg), p.where).not.toThrow();
    }
  });

  it("every text and frame pair is at least 4.5:1", () => {
    expect(failingPairs(TEXT_PAIRS, 4.5, byToken)).toEqual([]);
  });

  it("the sheet text is at least 4.5:1 on the film with its light sheen", () => {
    const lit = (bgToken: string) => lighten(hex(bgToken), SHEET_SHEEN);
    const pairs = TEXT_PAIRS.filter((p) => p.fg === "--xr-text-on-sheet");
    expect(failingPairs(pairs, 4.5, (p) => ({ fg: hex(p.fg), bg: lit(p.bg) }))).toEqual([]);
  });

  it("every focus ring pair is at least 3:1", () => {
    expect(failingPairs(FOCUS_PAIRS, 3, byToken)).toEqual([]);
  });

  it("self-test: a failing pair is detected", () => {
    const bad: Pair[] = [{ fg: "--xr-text-muted", bg: "--xr-text-dim", where: "deliberately low" }];
    expect(failingPairs(bad, 4.5, byToken)).toHaveLength(1);
    expect(failingPairs(TEXT_PAIRS.slice(0, 1), 4.5, byToken)).toEqual([]);
  });

  it("the contrast helper matches known values", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });
});
