import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Dr. Bones never calls an LLM. His text comes from fixed templates and the trace.
// Already guarded elsewhere (not repeated in full here):
//  - packages/xray-ui/src/__tests__/source-hygiene.test.ts: no fetch(, XMLHttpRequest, WebSocket,
//    api key, openai/anthropic import anywhere in xray-ui src.
//  - packages/xray-ui/src/__tests__/properties/chat-source.test.tsx: chat DOM text equals builder
//    output, with a net spy proving zero network calls.
// This file adds: (a) the chat source files by name, including EventSource, extraction imports and
// the word "llm"; (b) an allow-list of app src files that may call the network.
// The runtime check (c) lives in no-llm-in-chat.runtime.test.tsx.
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APP_SRC = join(APP_ROOT, "src");
const XRAY_SRC = resolve(APP_ROOT, "../../packages/xray-ui/src");

const CHAT_FILES = [
  "components/DrBonesChat.tsx",
  "components/chat/ChatLog.tsx",
  "components/panels/DoctorPanel.tsx",
  "model/chat.ts",
] as const;

/** Files in the app src that may reach the network (the extraction path only). */
const NETWORK_ALLOW_LIST: readonly string[] = [
  "extraction/HttpExtractionAdapter.ts",
  "extraction/liveStatus.ts",
];

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
  ["extraction adapter", /ExtractionAdapter|ExtractionPort|extraction\//],
];

const SPECIFIER =
  /(?:import|export)\s[^"']*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;

export function matches(text: string, rules: ReadonlyArray<readonly [string, RegExp]>): string[] {
  return rules.filter(([, re]) => re.test(text)).map(([name]) => name);
}

export function specifiers(text: string): string[] {
  return [...text.matchAll(SPECIFIER)].map((m) => (m[1] ?? m[2] ?? m[3] ?? m[4])!);
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
  it.each(CHAT_FILES)("xray-ui %s exists", (f) => {
    expect(existsSync(join(XRAY_SRC, f))).toBe(true);
  });

  it("chat files have no network API, LLM client or extraction adapter", () => {
    const hits = CHAT_FILES.flatMap((f) => {
      const text = readFileSync(join(XRAY_SRC, f), "utf8");
      return [...matches(text, NETWORK), ...matches(text, LLM)].map((m) => `${f}: ${m}`);
    });
    expect(hits).toEqual([]);
  });

  it("chat files import only relative modules, react, @bones/core and no app code", () => {
    const bad = CHAT_FILES.flatMap((f) =>
      specifiers(readFileSync(join(XRAY_SRC, f), "utf8"))
        .filter((s) => !(s.startsWith(".") || s === "react" || s === "@bones/core"))
        .map((s) => `${f}: ${s}`),
    );
    expect(bad).toEqual([]);
  });
});

describe("app src network allow-list", () => {
  const files = listSrc(APP_SRC);
  const rel = (f: string): string => relative(APP_SRC, f);

  it("allow-listed files exist", () => {
    for (const f of NETWORK_ALLOW_LIST) expect(existsSync(join(APP_SRC, f))).toBe(true);
  });

  it("only HttpExtractionAdapter and liveStatus use fetch or other network APIs", () => {
    expect(files.length).toBeGreaterThan(0);
    const hits = files
      .filter((f) => !NETWORK_ALLOW_LIST.includes(rel(f)))
      .flatMap((f) => matches(readFileSync(f, "utf8"), NETWORK).map((m) => `${rel(f)}: ${m}`));
    expect(hits).toEqual([]);
  });

  it("ui components do not import the network adapters", () => {
    const uiFiles = files.filter((f) => rel(f).startsWith("ui/"));
    expect(uiFiles.length).toBeGreaterThan(0);
    const bad = uiFiles.flatMap((f) =>
      specifiers(readFileSync(f, "utf8"))
        .filter((s) => /HttpExtractionAdapter|liveStatus/.test(s))
        .map((s) => `${rel(f)}: ${s}`),
    );
    expect(bad).toEqual([]);
  });

  it("scanners detect bad samples and accept clean ones", () => {
    expect(matches("await fetch(url)", NETWORK)).toEqual(["fetch"]);
    expect(matches("new EventSource(u); new WebSocket(u)", NETWORK)).toEqual(["WebSocket", "EventSource"]);
    expect(matches("import Anthropic from 'x'; // LLM", LLM)).toEqual(["anthropic", "llm"]);
    expect(matches("fetchLiveStatus(); const fetchImpl = 1;", NETWORK)).toEqual([]);
    expect(specifiers('import a from "../x"; import("y")')).toEqual(["../x", "y"]);
  });
});
