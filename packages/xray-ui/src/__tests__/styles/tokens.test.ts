import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "..", "..", "styles", "tokens.css"), "utf8");

function valueOf(name: string): string | undefined {
  return new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();
}

const NEW_TOKENS = [
  "--xr-font-serif", "--xr-font-sans", "--xr-font-mono",
  "--xr-text-on-steel-active", "--xr-steel-sheen", "--xr-engrave", "--xr-engrave-active",
  "--xr-bg-film", "--xr-bg-film-deep", "--xr-line-phone",
  "--xr-bg-pillbtn", "--xr-text-pillbtn", "--xr-line-pillbtn",
  "--xr-bg-header-glass", "--xr-line-header",
  "--xr-bg-pill", "--xr-text-pill", "--xr-line-pill",
  "--xr-stamp-alpha",
  "--xr-meter-face-a", "--xr-meter-face-b", "--xr-text-on-meter", "--xr-meter-zone", "--xr-meter-bezel",
];

const HEX_TOKENS = [
  "--xr-text-on-steel-active", "--xr-bg-film", "--xr-bg-film-deep",
  "--xr-bg-pillbtn", "--xr-text-pillbtn", "--xr-text-pill",
  "--xr-meter-face-a", "--xr-meter-face-b", "--xr-text-on-meter", "--xr-meter-zone", "--xr-meter-bezel",
];

describe("visual-polish-2 tokens", () => {
  it.each(NEW_TOKENS)("%s exists", (name) => {
    expect(valueOf(name), `missing token ${name}`).toBeDefined();
  });

  it.each(HEX_TOKENS)("%s is a six-digit hex colour", (name) => {
    expect(valueOf(name)).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("--xr-stamp-alpha is a plain number", () => {
    expect(Number(valueOf("--xr-stamp-alpha"))).toBe(0.82);
  });

  it("the pill fill is rgba with alpha at most 0.35", () => {
    const m = /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([0-9.]+)\s*\)$/.exec(valueOf("--xr-bg-pill") ?? "");
    expect(m, "--xr-bg-pill must be rgba").not.toBeNull();
    expect(Number(m![1])).toBeLessThanOrEqual(0.35);
  });

  it("the header glass is rgba", () => {
    expect(valueOf("--xr-bg-header-glass")).toMatch(/^rgba\(/);
  });
});
