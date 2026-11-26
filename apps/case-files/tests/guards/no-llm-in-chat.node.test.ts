import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Dr. Bones never calls an LLM. His text comes from rule message templates and the trace.
// (a) The files that build or place chat text have no network API, no LLM client word and no
//     import of an extraction adapter. (b) An allow-list names the src files that may use the
//     network. Case-files has none yet; the optional live mode would add its own adapter file here.
// The runtime check (c) is in no-llm-in-chat.runtime.test.tsx.
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APP_SRC = join(APP_ROOT, "src");

/** Files in `src` that build chat text or hand it to the chat panel. */
const CHAT_FILES = [
  "solver/solverMessages.ts",
  "ui/CaseScreen.tsx",
  "ui/VerdictView.tsx",
  "anatomy.ts",
] as const;

/** Files in `src` that may reach the network. None yet; live mode would add its adapter file. */
const NETWORK_ALLOW_LIST: readonly string[] = [];

const NETWORK: ReadonlyArray<readonly [string, RegExp]> = [
  ["fetch", /\bfetch\b/],
  ["XMLHttpRequest", /XMLHttpRequest/],
  ["WebSocket", /WebSocket/],
  ["EventSource", /EventSource/],
  ["sendBeacon", /sendBeacon/],
];

const LLM: ReadonlyArray<readonly [string, RegExp]> = [
  ["anthropic", /anthropic/i],
  ["openai", /openai/i],
  ["llm", /\bllm\b/i],
  ["extraction adapter", /ExtractionAdapter|ExtractionPort|CaseAdapter|extraction\//],
];

const SPECIFIER =
  /(?:import|export)\s[^"']*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;

/** Drops comments, so a doc comment saying "no LLM" is not a hit. */
export function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

export function matches(text: string, rules: ReadonlyArray<readonly [string, RegExp]>): string[] {
  const code = stripComments(text);
  return rules.filter(([, re]) => re.test(code)).map(([name]) => name);
}

export function specifiers(text: string): string[] {
  return [...stripComments(text).matchAll(SPECIFIER)].map((m) => (m[1] ?? m[2] ?? m[3] ?? m[4])!);
}

function listSrc(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listSrc(full));
    else if (extname(full) === ".ts" || extname(full) === ".tsx") out.push(full);
  }
  return out;
}

describe("Dr. Bones chat source never reaches a model", () => {
  it.each(CHAT_FILES)("%s exists", (f) => {
    expect(existsSync(join(APP_SRC, f))).toBe(true);
  });

  it("chat files have no network API, LLM client word or extraction adapter", () => {
    const hits = CHAT_FILES.flatMap((f) => {
      const text = readFileSync(join(APP_SRC, f), "utf8");
      return [...matches(text, NETWORK), ...matches(text, LLM)].map((m) => `${f}: ${m}`);
    });
    expect(hits).toEqual([]);
  });

  it("chat files import no extraction module and no LLM package", () => {
    const bad = CHAT_FILES.flatMap((f) =>
      specifiers(readFileSync(join(APP_SRC, f), "utf8"))
        .filter((s) => /extraction|anthropic|openai|@anthropic-ai/i.test(s))
        .map((s) => `${f}: ${s}`),
    );
    expect(bad).toEqual([]);
  });
});

describe("app src network allow-list", () => {
  const files = listSrc(APP_SRC);
  const rel = (f: string): string => relative(APP_SRC, f).split("\\").join("/");

  it("allow-listed files exist", () => {
    for (const f of NETWORK_ALLOW_LIST) expect(existsSync(join(APP_SRC, f))).toBe(true);
  });

  it("only allow-listed files use fetch or other network APIs", () => {
    expect(files.length).toBeGreaterThan(0);
    const hits = files
      .filter((f) => !NETWORK_ALLOW_LIST.includes(rel(f)))
      .flatMap((f) => matches(readFileSync(f, "utf8"), NETWORK).map((m) => `${rel(f)}: ${m}`));
    expect(hits).toEqual([]);
  });

  it("src/ui and src/state import no LLM client", () => {
    const scoped = files.filter((f) => /^(ui|state)\//.test(rel(f)));
    expect(scoped.length).toBeGreaterThan(0);
    const bad = scoped.flatMap((f) =>
      specifiers(readFileSync(f, "utf8"))
        .filter((s) => /anthropic|openai|@anthropic-ai/i.test(s))
        .map((s) => `${rel(f)}: ${s}`),
    );
    expect(bad).toEqual([]);
  });
});

describe("scanner self-tests", () => {
  it("detects network APIs and LLM words", () => {
    expect(matches("await fetch(url)", NETWORK)).toEqual(["fetch"]);
    expect(matches("new EventSource(u); new WebSocket(u)", NETWORK)).toEqual(["WebSocket", "EventSource"]);
    expect(matches("navigator.sendBeacon(u); new XMLHttpRequest()", NETWORK)).toEqual(["XMLHttpRequest", "sendBeacon"]);
    expect(matches("import Anthropic from 'x'; const llm = 1;", LLM)).toEqual(["anthropic", "llm"]);
    expect(matches("new RecordedCaseAdapter()", LLM)).toEqual(["extraction adapter"]);
  });

  it("accepts clean text and ignores comments and look-alike names", () => {
    expect(matches("fetchLiveStatus(); const fetchImpl = 1;", NETWORK)).toEqual([]);
    expect(matches("// no LLM, no fetch\n/* openai */ const a = 1;", [...NETWORK, ...LLM])).toEqual([]);
  });

  it("reads import specifiers", () => {
    expect(specifiers('import a from "../x"; import("y"); export { b } from "z";')).toEqual(["../x", "y", "z"]);
    expect(specifiers('// import a from "hidden"')).toEqual([]);
  });
});
