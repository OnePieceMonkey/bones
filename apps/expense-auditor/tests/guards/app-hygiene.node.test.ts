import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Requirements 6.8, 18.4, 18.6, 20.5: no motion in app.css (motion lives in xray-ui),
// no sound, no auth vocabulary in the app source.
// Related guards: no-visual-in-app.node.test.ts (images, url(), Shell style, auth words),
// no-llm-in-chat.* (Dr. Bones never reaches a model).
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = join(APP_ROOT, "src");
const APP_CSS = join(SRC, "styles", "app.css");
const SRC_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".html"]);

const CSS_MOTION: ReadonlyArray<readonly [string, RegExp]> = [
  ["transition", /transition/i],
  ["animation", /animation/i],
  ["@keyframes", /@keyframes/i],
];

const AUDIO: ReadonlyArray<readonly [string, RegExp]> = [
  ["AudioContext", /AudioContext/],
  ["new Audio", /new\s+Audio\b/],
  ["<audio", /<audio\b/i],
];

const AUTH_WORDS = ["login", "logout", "password", "oauth", "jwt", "bearer", "authenticate", "cookie"] as const;
const AUTH = new RegExp(`\\b(?:${AUTH_WORDS.join("|")})\\b`, "gi");

export function scan(text: string, rules: ReadonlyArray<readonly [string, RegExp]>): string[] {
  return rules.filter(([, re]) => re.test(text)).map(([name]) => name);
}

export function authWords(text: string): string[] {
  return [...text.matchAll(AUTH)].map((m) => m[0].toLowerCase());
}

function listSrc(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listSrc(full));
    else if (SRC_EXTENSIONS.has(extname(full))) out.push(full);
  }
  return out;
}

const files = listSrc(SRC);
const rel = (f: string): string => relative(APP_ROOT, f);

describe("app hygiene guard", () => {
  it("scans the app source and app.css", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain(APP_CSS);
  });

  it("app.css has no transition, animation or @keyframes", () => {
    expect(scan(readFileSync(APP_CSS, "utf8"), CSS_MOTION)).toEqual([]);
  });

  it("src has no audio", () => {
    const hits = files.flatMap((f) => scan(readFileSync(f, "utf8"), AUDIO).map((n) => `${rel(f)}: ${n}`));
    expect(hits).toEqual([]);
  });

  it("src has no auth words", () => {
    const hits = files.flatMap((f) => authWords(readFileSync(f, "utf8")).map((w) => `${rel(f)}: ${w}`));
    expect(hits).toEqual([]);
  });

  it("scanners detect bad samples", () => {
    expect(scan(".a{transition:none}", CSS_MOTION)).toEqual(["transition"]);
    expect(scan("@keyframes x{} .a{animation:x 1s}", CSS_MOTION)).toEqual(["animation", "@keyframes"]);
    expect(scan("new AudioContext(); new Audio('a'); <audio src>", AUDIO)).toEqual([
      "AudioContext",
      "new Audio",
      "<audio",
    ]);
    expect(authWords("Login, logout; Password jwt OAuth bearer authenticate cookie")).toHaveLength(8);
  });

  it("scanners accept clean samples and whole words only", () => {
    expect(scan(".a{color:red}", CSS_MOTION)).toEqual([]);
    expect(authWords("cookies authenticated loginForm bearers")).toEqual([]);
  });
});
