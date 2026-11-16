import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// Why this guard is new: the visual-polish look adds many animations and
// transitions. They must all live in src/styles/, every one needs a
// reduced-motion override, and they may only animate transform, opacity and
// filter (compositor-only properties). Nothing enforced this before.
const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "../..");
const ALLOWED_PROPS = new Set(["transform", "opacity", "filter"]);

export interface SourceFile {
  /** Path relative to src/, with forward slashes. */
  path: string;
  content: string;
}
export interface Violation {
  path: string;
  selector: string;
  reason: string;
}

interface Block {
  prelude: string;
  body: string;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** Splits CSS text into top-level blocks `prelude { body }`. */
function blocks(css: string): Block[] {
  const out: Block[] = [];
  let depth = 0;
  let start = 0;
  let bodyStart = 0;
  let prelude = "";
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      if (depth === 0) {
        prelude = css.slice(start, i).trim();
        bodyStart = i + 1;
      }
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        out.push({ prelude, body: css.slice(bodyStart, i) });
        start = i + 1;
      }
    } else if (c === ";" && depth === 0) {
      start = i + 1; // at-rule without a body, e.g. @import
    }
  }
  return out;
}

interface Rule {
  selector: string;
  body: string;
  inReduced: boolean;
}

/** Flat list of style rules and keyframes. @media and @supports are unwrapped. */
function collect(css: string, inReduced: boolean, rules: Rule[], keyframes: Rule[]): void {
  for (const b of blocks(css)) {
    if (/^@keyframes\b/i.test(b.prelude)) {
      keyframes.push({ selector: b.prelude, body: b.body, inReduced });
    } else if (/^@(media|supports|layer)\b/i.test(b.prelude)) {
      const reduced = inReduced || /prefers-reduced-motion\s*:\s*reduce/i.test(b.prelude);
      collect(b.body, reduced, rules, keyframes);
    } else if (!b.prelude.startsWith("@")) {
      rules.push({ selector: b.prelude.replace(/\s+/g, " "), body: b.body, inReduced });
    }
  }
}

function declarations(body: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let depth = 0;
  let cur = "";
  for (const c of body) {
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === ";" && depth === 0) {
      out.push(...parseDecl(cur));
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(...parseDecl(cur));
  return out;
}
function parseDecl(text: string): Array<[string, string]> {
  const i = text.indexOf(":");
  if (i < 0) return [];
  return [[text.slice(0, i).trim().toLowerCase(), text.slice(i + 1).trim()]];
}

function splitTopLevel(value: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const c of value) {
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === sep && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  parts.push(cur.trim());
  return parts.filter((p) => p !== "");
}

const isAnimDecl = (name: string): boolean => name === "animation" || name.startsWith("animation-");
const isTransDecl = (name: string): boolean => name === "transition" || name.startsWith("transition-");
const isNone = (value: string): boolean => /^none(\s*!important)?$/i.test(value.trim());
const isTimeOrKeyword = (t: string): boolean =>
  /^[\d.]+m?s$/i.test(t) ||
  /^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|allow-discrete|normal)$/i.test(t) ||
  /^(cubic-bezier|steps)\(/i.test(t);

/** Property names a transition declaration animates (empty when none). */
function transitionProps(name: string, value: string): string[] {
  const v = value.replace(/\s*!important\s*$/i, "");
  if (name === "transition-property") return splitTopLevel(v, ",").map((p) => p.toLowerCase());
  if (name !== "transition") return [];
  const props: string[] = [];
  for (const item of splitTopLevel(v, ",")) {
    const tokens = item.split(/\s+/);
    const prop = tokens.find((t) => !isTimeOrKeyword(t));
    props.push((prop ?? "all").toLowerCase());
  }
  return props;
}

const SHELL_PAIR = [
  '.xr-shell[data-motion="reduce"]',
  '.xr-shell[data-motion="auto"]',
];

function covered(selector: string, rules: Rule[]): boolean {
  const parts = selector.split(",").map((s) => s.trim());
  const reducedRules = rules.filter(
    (r) =>
      r.inReduced &&
      declarations(r.body).some(([n, v]) => (isAnimDecl(n) || isTransDecl(n)) && isNone(v)),
  );
  const reducedSelectors = reducedRules.flatMap((r) => r.selector.split(",").map((s) => s.trim()));
  const hasShellPair = SHELL_PAIR.every((s) =>
    rules.some(
      (r) =>
        r.selector.split(",").some((x) => x.trim().startsWith(s)) &&
        declarations(r.body).some(([n, v]) => (isAnimDecl(n) || isTransDecl(n)) && isNone(v)),
    ),
  );
  return parts.every((part) => {
    if (part.startsWith(".xr-shell")) return hasShellPair;
    if (reducedSelectors.includes(part)) return true;
    // The legacy catch-all `[class*="anim-"]` covers selectors whose subject carries an anim- class.
    return reducedSelectors.includes('[class*="anim-"]') && /\.anim-[\w-]+/.test(part);
  });
}

/** Scans all given files. Pure: works on the given contents. */
export function scanMotion(files: SourceFile[]): Violation[] {
  const out: Violation[] = [];
  for (const file of files) {
    const inStyles = file.path.startsWith("styles/");
    if (!file.path.endsWith(".css")) {
      const m = /@keyframes|\banimation(?:-[a-z-]+)?\s*:|\btransition(?:-[a-z-]+)?\s*:/.exec(file.content);
      if (m) out.push({ path: file.path, selector: m[0], reason: "motion declaration outside src/styles/" });
      continue;
    }
    const css = stripComments(file.content);
    const rules: Rule[] = [];
    const keyframes: Rule[] = [];
    collect(css, false, rules, keyframes);
    const motionRules = rules.filter(
      (r) => !r.inReduced && declarations(r.body).some(([n, v]) => (isAnimDecl(n) || isTransDecl(n)) && !isNone(v)),
    );
    if (!inStyles) {
      if (keyframes.length > 0 || motionRules.length > 0) {
        const sel = keyframes[0]?.selector ?? motionRules[0]?.selector ?? "";
        out.push({ path: file.path, selector: sel, reason: "motion declaration outside src/styles/" });
      }
      continue;
    }
    for (const r of motionRules) {
      if (!covered(r.selector, rules)) {
        out.push({ path: file.path, selector: r.selector, reason: "no reduced-motion override" });
      }
      for (const [n, v] of declarations(r.body)) {
        if (!isTransDecl(n) || isNone(v)) continue;
        for (const p of transitionProps(n, v)) {
          if (p !== "none" && !ALLOWED_PROPS.has(p)) {
            out.push({ path: file.path, selector: r.selector, reason: `transition animates "${p}"` });
          }
        }
      }
    }
    for (const k of keyframes) {
      for (const frame of blocks(k.body)) {
        for (const [n] of declarations(frame.body)) {
          if (isAnimDecl(n)) continue; // animation-timing-function inside a frame is not an animated property
          if (!ALLOWED_PROPS.has(n)) {
            out.push({ path: file.path, selector: k.selector, reason: `keyframes animate "${n}"` });
          }
        }
      }
    }
  }
  return out;
}

export function formatViolation(v: Violation): string {
  return `${v.path}: ${v.selector}: ${v.reason}`;
}

function listSource(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "__tests__" || name === "assets") continue;
      out.push(...listSource(full));
    } else if (/\.(css|ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe("motion guard", () => {
  it("motion lives in src/styles/, has a reduced-motion override and animates only transform, opacity, filter", () => {
    const files = listSource(srcDir).map((full) => ({
      path: relative(srcDir, full).split(sep).join("/"),
      content: readFileSync(full, "utf8"),
    }));
    expect(files.some((f) => f.path === "styles/xray.css")).toBe(true);
    expect(scanMotion(files).map(formatViolation)).toEqual([]);
  });

  describe("scanMotion", () => {
    const css = (content: string, path = "styles/a.css"): SourceFile => ({ path, content });
    const reasons = (f: SourceFile[]) => scanMotion(f).map((v) => v.reason);

    it("accepts a covered animation and a scoped shell animation", () => {
      const ok = css(`
        @keyframes k { from { opacity: 0; } to { opacity: 1; transform: none; } }
        .a { animation: k 1s; }
        @media (prefers-reduced-motion: reduce) { .a { animation: none; } }
        .xr-shell.xr-live .b { transition: transform 1s, opacity 1s; }
        .xr-shell[data-motion="reduce"], .xr-shell[data-motion="reduce"] * { animation: none !important; transition: none !important; }
        .xr-shell[data-motion="auto"] { animation: none !important; }
      `);
      expect(scanMotion([ok])).toEqual([]);
    });
    it("rejects @keyframes, animation and transition outside src/styles/", () => {
      expect(reasons([css(".a { animation: k 1s; }", "components/a.css")])).toEqual([
        "motion declaration outside src/styles/",
      ]);
      expect(reasons([{ path: "components/A.tsx", content: 'const s = { transition: "x" };' }])).toEqual([
        "motion declaration outside src/styles/",
      ]);
    });
    it("rejects an animation without a reduced-motion override and names file and selector", () => {
      const [v] = scanMotion([css(".a { animation: k 1s; }")]);
      expect(v && formatViolation(v)).toBe("styles/a.css: .a: no reduced-motion override");
    });
    it("rejects a .xr-shell selector without the scoped catch-all pair", () => {
      expect(reasons([css(".xr-shell .a { transition: opacity 1s; }")])).toEqual(["no reduced-motion override"]);
    });
    it("rejects keyframes that animate other properties", () => {
      const bad = css(`
        @keyframes k { from { background: red; } to { left: 1px; } }
        .a { animation: k 1s; }
        @media (prefers-reduced-motion: reduce) { .a { animation: none; } }
      `);
      expect(reasons([bad])).toEqual(['keyframes animate "background"', 'keyframes animate "left"']);
    });
    it("rejects transitions on other properties, including all", () => {
      const bad = css(`
        .a { transition: background 0.2s ease, opacity 1s; }
        .b { transition: 1s; }
        @media (prefers-reduced-motion: reduce) { .a, .b { transition: none; } }
      `);
      expect(reasons([bad])).toEqual(['transition animates "background"', 'transition animates "all"']);
    });
  });
});
