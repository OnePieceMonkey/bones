import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// Look and motion live in packages/xray-ui. The app only arranges components.
// app.css carries layout only; the `body` rule may carry the page colours and font.
// No @keyframes or animation anywhere in the app (requirement 16.9), no image import,
// no url( and no @import (requirements 14.10, 16.2).
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APP_SRC = join(APP_ROOT, "src");
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "playwright-report", "test-results", "tests", "e2e"]);

interface Rule {
  readonly construct: string;
  readonly pattern: RegExp;
  readonly exts?: readonly string[];
}

const RULES: readonly Rule[] = [
  {
    construct: "image import",
    pattern: /(?:\bfrom\s+|\bimport\s*\(?\s*|\brequire\s*\(\s*)["'][^"']+\.(?:webp|png|jpe?g|gif|svg|avif)(?:\?[^"']*)?["']/i,
  },
  { construct: "css url(", pattern: /(?<![A-Za-z0-9_])url\s*\(/ },
  { construct: "css @import", pattern: /@import\b/, exts: [".css"] },
  { construct: "@keyframes", pattern: /@keyframes\b/ },
  { construct: "transition", pattern: /\btransition(?:-[a-z]+)*\b/i },
  { construct: "animation", pattern: /\banimation(?:-[a-z]+)*\b/i },
  {
    construct: "style= on Shell element",
    pattern: /<(?:Shell|ShellFrame)\b[^>]*\bstyle\s*=/s,
    exts: [".tsx"],
  },
  {
    // app.css keeps layout only. The `body` block is exempt (see stripBodyBlock).
    construct: "visual declaration in app.css",
    pattern:
      /(?:^|[;{\s])(?:border(?:-[a-z]+)*|box-shadow|text-shadow|font(?:-[a-z]+)*|color|background(?:-[a-z]+)*|outline(?:-[a-z]+)*|filter|backdrop-filter|opacity)\s*:/m,
    exts: [".css"],
  },
];

export interface Violation {
  readonly file: string;
  readonly construct: string;
}

/** Removes every top-level `body { ... }` block so the body rule may carry the page colours and font. */
export function stripBodyBlock(css: string): string {
  return css.replace(/(^|[}\s])body\s*\{[^}]*\}/g, "$1");
}

/** Removes CSS comments so prose in comments is not scanned. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

export function scanSource(file: string, text: string): Violation[] {
  const ext = extname(file);
  const out: Violation[] = [];
  for (const rule of RULES) {
    if (rule.exts && !rule.exts.includes(ext)) continue;
    let subject = ext === ".css" ? stripCssComments(text) : text;
    if (rule.construct === "visual declaration in app.css") subject = stripBodyBlock(subject);
    if (rule.pattern.test(subject)) out.push({ file, construct: rule.construct });
  }
  return out;
}

function listFiles(dir: string, skip: ReadonlySet<string> = new Set()): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, skip));
    else if (EXTENSIONS.has(extname(full))) out.push(full);
  }
  return out;
}

describe("app source guard", () => {
  it("contains no visual constructs in src", () => {
    const violations = listFiles(APP_SRC).flatMap((f) =>
      scanSource(relative(APP_SRC, f), readFileSync(f, "utf8")),
    );
    expect(
      violations.map((v) => `${v.file}: ${v.construct}`),
      "forbidden constructs in app source",
    ).toEqual([]);
  });

  it("src/styles/app.css exists", () => {
    expect(existsSync(join(APP_SRC, "styles", "app.css"))).toBe(true);
  });

  it("has no @keyframes or animation anywhere in the app (requirement 16.9)", () => {
    const files = [
      ...listFiles(APP_ROOT, SKIP_DIRS),
      ...["index.html"].map((n) => join(APP_ROOT, n)).filter(existsSync),
    ];
    const hits: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      if (/@keyframes\b/.test(text) || /\banimation(?:-[a-z]+)*\s*:/i.test(text)) {
        hits.push(relative(APP_ROOT, f));
      }
    }
    expect(hits).toEqual([]);
  });

  it("scanner reports file and construct for bad samples", () => {
    const bad: Array<[string, string, string]> = [
      ["a.ts", 'import logo from "./logo.png";', "image import"],
      ["a.css", ".a { background: url(x.webp); }", "css url("],
      ["a.css", '@import "x.css";', "css @import"],
      ["a.css", "@keyframes spin { to { opacity: 1 } }", "@keyframes"],
      ["a.css", ".a { transition: opacity 1s; }", "transition"],
      ["a.css", ".a { animation: spin 1s; }", "animation"],
      ["a.tsx", '<Shell heading="x" style={{ top: 1 }} />', "style= on Shell element"],
      ["app.css", ".a { color: red; }", "visual declaration in app.css"],
      ["app.css", ".a { box-shadow: 0 0 1px red; }", "visual declaration in app.css"],
      ["app.css", ".a { font-size: 12px; }", "visual declaration in app.css"],
      ["app.css", "body { margin: 0; }\n.a { border: 1px solid; }", "visual declaration in app.css"],
      ["app.css", "body { margin: 0; }\n.a { background-color: #000; }", "visual declaration in app.css"],
    ];
    for (const [file, text, construct] of bad) {
      expect(scanSource(file, text)).toContainEqual({ file, construct });
    }
  });

  it("scanner accepts clean samples", () => {
    expect(scanSource("a.ts", "URL.createObjectURL(blob);")).toEqual([]);
    expect(scanSource("a.tsx", '<Shell heading="x" />')).toEqual([]);
    expect(
      scanSource("app.css", ".a { display: flex; gap: 4px; position: relative; z-index: 3; transform: translateX(-50%); }"),
    ).toEqual([]);
    expect(scanSource("app.css", "body { color: red; background: #000; font-family: x; }")).toEqual([]);
    expect(scanSource("app.css", "/* colour: border: background: */ .a { margin: 0; }")).toEqual([]);
  });
});
