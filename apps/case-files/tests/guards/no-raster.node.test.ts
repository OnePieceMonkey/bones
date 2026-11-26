import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// The look is drawn by CSS and SVG in packages/xray-ui. The app and its rule files add no raster
// files (requirement 16.4). Only the e2e reference screenshots may be PNG.
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RULES_ROOT = resolve(APP_ROOT, "../../rules/case-files");
const RASTER = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "playwright-report", "test-results"]);
const ALLOWED_PREFIX = `e2e${sep}__screenshots__${sep}`;

/** Relative paths (to `root`) of raster files that are not allowed. */
export function findRaster(files: readonly string[]): string[] {
  return files.filter((f) => RASTER.has(extname(f).toLowerCase()) && !f.startsWith(ALLOWED_PREFIX));
}

function walk(dir: string, root: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, root));
    else out.push(relative(root, full));
  }
  return out;
}

describe("no raster files", () => {
  it("apps/case-files has no raster file outside e2e/__screenshots__", () => {
    expect(findRaster(walk(APP_ROOT, APP_ROOT))).toEqual([]);
  });

  it("rules/case-files has no raster file", () => {
    expect(existsSync(RULES_ROOT)).toBe(true);
    expect(findRaster(walk(RULES_ROOT, RULES_ROOT))).toEqual([]);
  });

  it("scanner flags every raster extension outside the e2e reference folder", () => {
    const bad = ["a.png", "src/b.JPG", "src/c.jpeg", "d.webp", "e.gif", "f.avif", `e2e${sep}x.png`];
    expect(findRaster(bad)).toEqual(bad);
  });

  it("scanner accepts e2e reference PNGs and non-raster files", () => {
    expect(findRaster([`e2e${sep}__screenshots__${sep}a${sep}start.png`, "src/a.ts", "logo.svg"])).toEqual([]);
  });
});
