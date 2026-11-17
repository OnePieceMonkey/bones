import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildOnce } from "../helpers/build";

// Requirements 11.11, 19.15, 21.13: the currency code is never spelled out as a word.
// The pattern is built from two parts so this file does not match itself.
const CODE = ["E", "UR"].join("");
const WHOLE_WORD = new RegExp(`\\b${CODE}\\b`);

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPO_ROOT = resolve(APP_ROOT, "../..");

/** Only text files are scanned. Screenshots and other binaries are skipped. */
const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".css", ".html", ".md", ".svg", ".txt", ".map",
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

export function findMatches(files: string[], base: string): string[] {
  const hits: string[] = [];
  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase())) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (WHOLE_WORD.test(line)) hits.push(`${relative(base, file)}:${i + 1}`);
    });
  }
  return hits;
}

describe("no-currency-code guard", () => {
  for (const dir of ["src", "recorded", "e2e"]) {
    it(`${dir} has no whole-word currency code`, () => {
      const root = join(APP_ROOT, dir);
      expect(existsSync(root), `${dir} should exist`).toBe(true);
      expect(findMatches(walk(root), APP_ROOT)).toEqual([]);
    });
  }

  it("built dist has no whole-word currency code", async () => {
    const { files, outDir } = await buildOnce();
    expect(files.length).toBeGreaterThan(0);
    expect(findMatches(files, outDir)).toEqual([]);
  }, 120_000);

  for (const rel of ["packages/xray-ui/demo/anatomy.ts", "packages/xray-ui/README.md"]) {
    const path = join(REPO_ROOT, rel);
    // Skipped explicitly when the file is absent instead of failing.
    it.skipIf(!existsSync(path))(`${rel} has no whole-word currency code`, () => {
      expect(findMatches([path], REPO_ROOT)).toEqual([]);
    });
  }

  it("detects a whole word and ignores embedded letters", () => {
    expect(WHOLE_WORD.test(`total 5 ${CODE}`)).toBe(true);
    expect(WHOLE_WORD.test(`${CODE}O`)).toBe(false);
    expect(WHOLE_WORD.test(CODE.toLowerCase())).toBe(false);
  });
});
