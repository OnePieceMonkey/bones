import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Requirement 20.1 (and 1.4): this app never imports from the expense app.
// The forbidden name is built from two parts so this file does not match itself.
const FORBIDDEN = ["expense", "auditor"].join("-");

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCANNED_DIRS = ["src", "api", "shared", "tests", "e2e"] as const;
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css"]);
const SKIPPED_DIRS = new Set(["node_modules", "dist", "__screenshots__"]);

// from "x", import "x", import("x"), require("x"), export ... from "x", @import "x"
const SPECIFIER_PATTERNS: readonly RegExp[] = [
  /\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g,
  /@import\s+(?:url\(\s*)?["']([^"']+)["']/g,
];

export interface Violation {
  readonly file: string;
  readonly detail: string;
}

export function findSpecifiers(text: string): string[] {
  const out: string[] = [];
  for (const re of SPECIFIER_PATTERNS) {
    for (const m of text.matchAll(re)) out.push(m[1]!);
  }
  return out;
}

export function scanFile(relPath: string, text: string): Violation[] {
  const out: Violation[] = [];
  for (const spec of new Set(findSpecifiers(text))) {
    if (spec.includes(FORBIDDEN)) out.push({ file: relPath, detail: `import "${spec}"` });
  }
  return out;
}

export function pathViolation(relPath: string): Violation[] {
  const hit = relPath.split(/[\\/]/).some((segment) => segment === FORBIDDEN);
  return hit ? [{ file: relPath, detail: "path names the other app" }] : [];
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (SKIPPED_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
}

describe("no imports from the expense app", () => {
  it("src, api, shared, tests and e2e never reference it", () => {
    const violations: Violation[] = [];
    let scanned = 0;
    for (const dirName of SCANNED_DIRS) {
      const dir = join(APP_ROOT, dirName);
      if (!existsSync(dir)) continue;
      const files: string[] = [];
      walk(dir, files);
      for (const file of files) {
        const rel = relative(APP_ROOT, file);
        violations.push(...pathViolation(rel));
        if (!CODE_EXTENSIONS.has(extname(file))) continue;
        scanned += 1;
        violations.push(...scanFile(rel, readFileSync(file, "utf8")));
      }
    }
    expect(scanned).toBeGreaterThan(0);
    expect(violations.map((v) => `${v.file}: ${v.detail}`)).toEqual([]);
  });

  it("scanner flags relative, workspace, dynamic and CSS specifiers", () => {
    const bad = [
      `import x from "../../${FORBIDDEN}/src/a";`,
      `import { y } from "@bones/${FORBIDDEN}";`,
      `const m = await import("apps/${FORBIDDEN}/z");`,
      `const r = require("${FORBIDDEN}");`,
      `export * from "../${FORBIDDEN}/index";`,
      `import "${FORBIDDEN}/side-effect";`,
      `@import "../${FORBIDDEN}/src/styles/app.css";`,
      `@import url("../${FORBIDDEN}/app.css");`,
    ];
    for (const text of bad) {
      expect(scanFile("a.ts", text), text).toHaveLength(1);
    }
    expect(pathViolation(`src/${FORBIDDEN}/a.ts`)).toHaveLength(1);
    expect(pathViolation(`e2e/__x/${FORBIDDEN}/a.ts`)).toHaveLength(1);
  });

  it("scanner accepts clean imports", () => {
    const good = 'import { a } from "@bones/core";\nimport b from "./b";\n@import "./other.css";';
    expect(scanFile("a.ts", good)).toEqual([]);
    expect(pathViolation("src/ui/StartScreen.tsx")).toEqual([]);
  });

  it("the other direction: the expense guard exists", () => {
    // `pnpm -r test` runs it; the task does not edit it.
    const other = resolve(APP_ROOT, "..", FORBIDDEN, "tests/guards", `no-${["case", "files"].join("-")}.node.test.ts`);
    expect(existsSync(other)).toBe(true);
  });
});
