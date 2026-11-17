import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "../helpers/contrast";

// app.css only names xray-ui tokens. This guard resolves them from tokens.css,
// checks that each one exists and checks the colour pairs app.css puts together.

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

// [foreground, background, minimum ratio, where app.css uses it]
const TEXT_PAIRS: ReadonlyArray<readonly [string, string, string]> = [
  ["--xr-text", "--xr-bg-panel", "body/dialog text on panel"],
  ["--xr-text", "--xr-bg-deep", "body text on deep"],
  ["--xr-text-dim", "--xr-bg-panel", "dim text on panel"],
  ["--xr-text-dim", "--xr-bg-deep", ".app-trip-text on deep"],
  ["--xr-text", "--xr-bg-row", ".app-input text on row"],
  ["--xr-text-dim", "--xr-bg-row", ".app-counter / input border on row"],
  ["--xr-text-on-plate", "--xr-bg-plate", ".app-note, .app-button plate text"],
  ["--xr-text-muted", "--xr-bg-plate", ".app-button:disabled"],
  ["--xr-text-on-cyan", "--xr-bg-cyan-fill", ".app-button-primary"],
  ["--xr-text-stamp", "--xr-bg-stamp", ".app-error, .app-field-error"],
  ["--xr-cyan", "--xr-bg-panel", ".app-dialog h2"],
];

const FOCUS_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["--xr-focus", "--xr-bg-panel"],
  ["--xr-focus", "--xr-bg-deep"],
  ["--xr-focus", "--xr-bg-plate"],
];

describe("contrast guard", () => {
  it("every var(--...) token named in app.css exists in tokens.css", () => {
    const used = new Set([...APP_CSS.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((m) => m[1]!));
    expect(used.size).toBeGreaterThan(0);
    // --xr-u is a runtime layout unit set by the Shell, with a fallback in app.css.
    const missing = [...used].filter((t) => t !== "--xr-u" && !tokens.has(t));
    expect(missing).toEqual([]);
  });

  it("every colour token app.css uses in a checked pair is covered", () => {
    const colourTokens = [...APP_CSS.matchAll(/(?:^|[;{\s])(?:color|background|border(?:-color)?|outline)\s*:[^;]*var\(\s*(--xr-(?:text|bg)[a-z-]*)/gim)].map(
      (m) => m[1]!,
    );
    const covered = new Set([...TEXT_PAIRS.flatMap((p) => [p[0], p[1]]), "--xr-bg-metal-dark"]);
    expect(colourTokens.filter((t) => !covered.has(t))).toEqual([]);
  });

  it.each(TEXT_PAIRS)("%s on %s is at least 4.5 (%s)", (fg, bg) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(FOCUS_PAIRS)("focus ring %s on %s is at least 3", (fg, bg) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(3);
  });

  it("the contrast helper matches known values", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });
});
