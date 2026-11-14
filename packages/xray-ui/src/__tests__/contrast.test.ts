import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "./helpers/contrast";

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
];

function hexOf(name: string): string | undefined {
  const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  return m?.[1];
}

describe("token contrast", () => {
  it("defines 15 pairs", () => {
    expect(TOKEN_PAIRS).toHaveLength(15);
  });

  it("every pair token exists in tokens.css with a hex value", () => {
    for (const { fg, bg } of TOKEN_PAIRS) {
      expect(hexOf(fg), fg).toBeDefined();
      expect(hexOf(bg), bg).toBeDefined();
    }
  });

  it.each(TOKEN_PAIRS.map((p) => [p.fg, p.bg, p] as const))(
    "%s on %s has ratio >= 4.5",
    (_fg, _bg, pair) => {
      const ratio = contrastRatio(hexOf(pair.fg)!, hexOf(pair.bg)!);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    },
  );
});
