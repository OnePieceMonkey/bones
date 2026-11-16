import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(here, "..", "..");
const srcDir = resolve(here, "..");
const nodeModules = join(pkgDir, "node_modules");

export const FONT_BUDGET = 30_720;

/** Returns every font file url() target in a CSS text. */
export function fontRefs(css: string): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: string[] = [];
  for (const m of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)/gi)) {
    const t = m[1] ?? m[2] ?? m[3] ?? "";
    if (/\.(woff2?|ttf|otf|eot)$/i.test(t)) out.push(t);
  }
  return out;
}

export function checkFontBudget(sizes: readonly number[], budget: number): string[] {
  const total = sizes.reduce((a, b) => a + b, 0);
  return total > budget ? [`font total ${total} bytes exceeds allowed ${budget} bytes`] : [];
}

function listSrc(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "__tests__" || name === "assets") continue;
      out.push(...listSrc(full));
    } else if (/\.(css|ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("font budget", () => {
  const css = readFileSync(join(srcDir, "styles", "fonts.css"), "utf8");
  const refs = fontRefs(css);

  it("references exactly one font file, a woff2, and no woff", () => {
    expect(refs).toEqual(["@fontsource/cormorant-sc/files/cormorant-sc-latin-700-normal.woff2"]);
    expect(refs.some((r) => /\.woff$/i.test(r))).toBe(false);
  });

  it("the referenced file exists and stays within 30,720 B", () => {
    const sizes = refs.map((r) => statSync(join(nodeModules, r)).size);
    const problems = checkFontBudget(sizes, FONT_BUDGET);
    expect(problems, problems.join("; ")).toEqual([]);
  });

  it("failure message shows measured and allowed bytes", () => {
    expect(checkFontBudget([20_352, 25_948], FONT_BUDGET)).toEqual([
      "font total 46300 bytes exceeds allowed 30720 bytes",
    ]);
    expect(checkFontBudget([20_352], FONT_BUDGET)).toEqual([]);
  });

  it("declares the face with weight 700 and font-display swap", () => {
    expect(css).toMatch(/font-family:\s*"Cormorant SC"/);
    expect(css).toMatch(/font-weight:\s*700/);
    expect(css).toMatch(/font-display:\s*swap/);
    expect(css).toMatch(/format\("woff2"\)/);
  });

  it("imports no @fontsource package CSS in src/", () => {
    const bad: string[] = [];
    for (const f of listSrc(srcDir)) {
      const text = readFileSync(f, "utf8");
      if (/(?:@import|import|from)\s*(?:url\()?\s*["']?@fontsource\/[^"')\s]*\.css/.test(text)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });

  it("pins @fontsource/cormorant-sc and sharp to exact versions", () => {
    const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of ["@fontsource/cormorant-sc", "sharp"]) {
      const v = all[name];
      expect(v, `missing ${name}`).toBeDefined();
      expect(v, `${name} is not pinned: ${v}`).not.toMatch(/[\^~]/);
    }
  });
});
