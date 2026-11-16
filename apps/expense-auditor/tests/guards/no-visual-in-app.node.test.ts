import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Look and motion live in packages/xray-ui. The app only arranges components,
// plays no sound and has no login. This guard keeps those constructs out of the app source.

const APP_SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../../src");
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

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
  { construct: "@keyframes", pattern: /@keyframes\b/ },
  { construct: "transition", pattern: /\btransition(?:-[a-z]+)*\b/i },
  { construct: "animation", pattern: /\banimation(?:-[a-z]+)*\b/i },
  {
    construct: "style= on Shell element",
    pattern: /<(?:Shell|ShellFrame)\b[^>]*\bstyle\s*=/s,
    exts: [".tsx"],
  },
  { construct: "audio (AudioContext)", pattern: /\bAudioContext\b/ },
  { construct: "audio (new Audio)", pattern: /\bnew\s+Audio\s*\(/ },
  {
    construct: "auth",
    pattern: /\b(?:login|logout|signIn|signOut|password|oauth|jwt|bearer|authorization|authenticat\w*)\b/i,
  },
];

export interface Violation {
  readonly file: string;
  readonly construct: string;
}

export function scanSource(file: string, text: string): Violation[] {
  const ext = extname(file);
  const out: Violation[] = [];
  for (const rule of RULES) {
    if (rule.exts && !rule.exts.includes(ext)) continue;
    if (rule.pattern.test(text)) out.push({ file, construct: rule.construct });
  }
  return out;
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else if (EXTENSIONS.has(extname(full))) out.push(full);
  }
  return out;
}

describe("app source guard", () => {
  it("contains no visual, audio or auth constructs", () => {
    const violations = listFiles(APP_SRC).flatMap((f) =>
      scanSource(relative(APP_SRC, f), readFileSync(f, "utf8")),
    );
    expect(
      violations.map((v) => `${v.file}: ${v.construct}`),
      "forbidden constructs in app source",
    ).toEqual([]);
  });

  it("scanner reports file and construct for bad samples", () => {
    const bad: Array<[string, string, string]> = [
      ["a.ts", 'import logo from "./logo.png";', "image import"],
      ["a.css", ".a { background: url(x.webp); }", "css url("],
      ["a.css", "@keyframes spin { to { opacity: 1 } }", "@keyframes"],
      ["a.css", ".a { transition: opacity 1s; }", "transition"],
      ["a.css", ".a { animation: spin 1s; }", "animation"],
      ["a.tsx", '<Shell heading="x" style={{ top: 1 }} />', "style= on Shell element"],
      ["a.ts", "const c = new AudioContext();", "audio (AudioContext)"],
      ["a.ts", 'const a = new Audio("x");', "audio (new Audio)"],
      ["a.ts", 'headers.Authorization = "x";', "auth"],
    ];
    for (const [file, text, construct] of bad) {
      expect(scanSource(file, text)).toContainEqual({ file, construct });
    }
  });

  it("scanner accepts clean samples", () => {
    expect(scanSource("a.ts", "URL.createObjectURL(blob);")).toEqual([]);
    expect(scanSource("a.tsx", '<Shell heading="x" />')).toEqual([]);
  });
});
