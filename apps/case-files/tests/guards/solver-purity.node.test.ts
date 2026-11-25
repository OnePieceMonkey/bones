import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The pure kernel files of the app (requirement 20.7). */
const PURE_FILES = [
  "src/derive/factDeriver.ts",
  "src/rules/binder.ts",
  "src/solver/solve.ts",
  "src/solver/solverMessages.ts",
];

const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
  ["Date.now", /\bDate\.now\b/],
  ["new Date(", /\bnew\s+Date\s*\(/],
  ["Math.random", /\bMath\.random\b/],
  ["crypto", /\bcrypto\b/],
  ["fetch", /\bfetch\b/],
  ["eval", /\beval\s*\(/],
  ["new Function", /\bnew\s+Function\b/],
];

/** Removes block and line comments and string-free noise so words in docs do not count. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/**
 * Returns the purity violations of one source text. Empty means clean.
 * Allowed imports: `@bones/core` and relative files. A type-only import of
 * `@bones/xray-ui` is also allowed (erased at compile time; used for `ChatMessage`).
 */
export function purityViolations(source: string): string[] {
  const out: string[] = [];
  const code = stripComments(source);
  for (const [name, re] of FORBIDDEN) if (re.test(code)) out.push(`forbidden: ${name}`);
  const specs: Array<{ spec: string; typeOnly: boolean }> = [];
  for (const m of code.matchAll(/\bimport\s+(type\s+)?[^"';]*?\bfrom\s*["']([^"']+)["']/g)) {
    specs.push({ spec: m[2] ?? "", typeOnly: Boolean(m[1]) });
  }
  for (const m of code.matchAll(/\bimport\s*["']([^"']+)["']/g)) specs.push({ spec: m[1] ?? "", typeOnly: false });
  for (const m of code.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    specs.push({ spec: m[1] ?? "", typeOnly: false });
  }
  for (const { spec, typeOnly } of specs) {
    const ok =
      spec === "@bones/core" || spec.startsWith("./") || spec.startsWith("../") || (typeOnly && spec === "@bones/xray-ui");
    if (!ok) out.push(`import not allowed: ${spec}`);
  }
  if (/\bevaluateCondition\b/.test(code)) out.push("own rule evaluator: evaluateCondition");
  return out;
}

function listTs(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files.push(...listTs(p));
    else if (/\.(ts|tsx)$/.test(name)) files.push(p);
  }
  return files;
}

describe("solver, deriver and binder purity guard", () => {
  it("self-test: a clean sample has no violations", () => {
    const clean = [
      'import { evaluate } from "@bones/core";',
      'import type { ChatMessage } from "@bones/xray-ui";',
      'import { x } from "../derive/factDeriver";',
      "// Date.now in a comment is fine",
      "export const f = () => evaluate;",
    ].join("\n");
    expect(purityViolations(clean)).toEqual([]);
  });

  it("self-test: an impure sample is caught", () => {
    const bad = [
      'import _ from "lodash";',
      'import { ChatMessage } from "@bones/xray-ui";',
      "export const t = Date.now() + Math.random();",
      "export const d = new Date();",
      'export const r = fetch("/x");',
      'export const e = eval("1");',
      'export const g = new Function("return 1");',
      "export const h = crypto.randomUUID();",
      "function evaluateCondition() {}",
    ].join("\n");
    const v = purityViolations(bad);
    for (const needle of [
      "forbidden: Date.now",
      "forbidden: new Date(",
      "forbidden: Math.random",
      "forbidden: crypto",
      "forbidden: fetch",
      "forbidden: eval",
      "forbidden: new Function",
      "import not allowed: lodash",
      "import not allowed: @bones/xray-ui",
      "own rule evaluator: evaluateCondition",
    ]) {
      expect(v, needle).toContain(needle);
    }
  });

  it("the four kernel files are pure", () => {
    for (const rel of PURE_FILES) {
      const source = readFileSync(join(APP_ROOT, rel), "utf8");
      expect(purityViolations(source), rel).toEqual([]);
    }
  });

  it("no rule evaluator other than core evaluate exists in src", () => {
    for (const file of listTs(join(APP_ROOT, "src"))) {
      expect(/\bevaluateCondition\b/.test(stripComments(readFileSync(file, "utf8"))), file).toBe(false);
    }
  });
});
