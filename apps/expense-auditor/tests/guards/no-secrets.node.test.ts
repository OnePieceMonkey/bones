import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { buildOnce, CANARY_KEY, cleanupBuild, OPENROUTER_CANARY_KEY } from "../helpers/build";

// Requirements 16.5, 19.11: no key, key name, provider header or provider host reaches the browser bundle.
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = join(APP_ROOT, "src");

interface Pattern {
  label: string;
  re: RegExp;
}

const NAMES: Pattern[] = [
  { label: "ANTHROPIC_API_KEY", re: /ANTHROPIC_API_KEY/ },
  { label: "OPENROUTER_API_KEY", re: /OPENROUTER_API_KEY/ },
  { label: "LLM_PROVIDER", re: /LLM_PROVIDER/ },
  { label: "LIVE_EXTRACTION", re: /LIVE_EXTRACTION/ },
  { label: "EXTRACTION_MODEL", re: /EXTRACTION_MODEL/ },
  { label: "sk- token", re: /sk-[A-Za-z0-9_-]{20,}/ },
  { label: "sk-ant-", re: /sk-ant-/ },
];

/** Extra checks for the built output: canary value and provider wire details. */
const DIST_EXTRA: Pattern[] = [
  { label: "canary key", re: new RegExp(CANARY_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) },
  { label: "openrouter canary key", re: new RegExp(OPENROUTER_CANARY_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) },
  { label: "openrouter.ai", re: /openrouter\.ai/i },
  { label: "Bearer", re: /bearer/i },
  { label: "x-api-key", re: /x-api-key/i },
  { label: "anthropic-version", re: /anthropic-version/i },
  { label: "api.anthropic.com", re: /api\.anthropic\.com/i },
];

const SRC_EXTRA: Pattern[] = [
  { label: "api key", re: /api[_-]?key/i },
  { label: "x-api-key", re: /x-api-key/i },
  { label: "VITE_ name with KEY or SECRET", re: /VITE_[A-Z0-9_]*(?:KEY|SECRET)[A-Z0-9_]*/i },
];

export function scanText(file: string, text: string, patterns: Pattern[]): string[] {
  const out: string[] = [];
  for (const { label, re } of patterns) {
    const m = re.exec(text);
    if (m) out.push(`${file}: ${label}: "${m[0]}"`);
  }
  return out;
}

function listAll(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listAll(full));
    else out.push(full);
  }
  return out;
}

export function scanDist(outDir: string, files: string[]): string[] {
  const out: string[] = [];
  for (const file of files) {
    const rel = relative(outDir, file);
    if (file.endsWith(".map")) out.push(`${rel}: source map`);
    out.push(...scanText(rel, readFileSync(file, "latin1"), [...NAMES, ...DIST_EXTRA]));
  }
  return out;
}

afterAll(cleanupBuild);

describe("secret scan", () => {
  it("builds with canary server variables and finds nothing in the output", async () => {
    const { outDir, files } = await buildOnce();
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.endsWith(".html"))).toBe(true);
    expect(files.some((f) => f.endsWith(".js"))).toBe(true);
    expect(scanDist(outDir, files)).toEqual([]);
  }, 120_000);

  it("finds no key names, tokens or key-like VITE_ names in src", () => {
    const hits: string[] = [];
    for (const file of listAll(SRC)) {
      hits.push(...scanText(relative(APP_ROOT, file), readFileSync(file, "utf8"), [...NAMES, ...SRC_EXTRA]));
    }
    expect(hits).toEqual([]);
  });

  it("self-test: the scanner detects the canary, headers and host in a fake dist", () => {
    const dir = mkdtempSync(join(tmpdir(), "bones-scan-selftest-"));
    try {
      mkdirSync(join(dir, "assets"));
      const clean = join(dir, "index.html");
      const dirty = join(dir, "assets", "a.js");
      const map = join(dir, "assets", "a.js.map");
      writeFileSync(clean, "<html>/api/extract</html>");
      writeFileSync(dirty, `fetch("https://API.Anthropic.com/v1",{headers:{"X-API-Key":"${CANARY_KEY}","Anthropic-Version":"1",Authorization:"Bearer ${OPENROUTER_CANARY_KEY}"}});fetch("https://openrouter.ai/api")`);
      writeFileSync(map, "{}");
      const hits = scanDist(dir, [clean, dirty, map]);
      const text = hits.join("\n");
      expect(text).toContain("canary key");
      expect(text).toContain("x-api-key");
      expect(text).toContain("anthropic-version");
      expect(text).toContain("api.anthropic.com");
      expect(text).toContain("openrouter canary key");
      expect(text).toContain("openrouter.ai");
      expect(text).toContain("Bearer");
      expect(text).toContain("a.js.map: source map");
      expect(hits.some((h) => h.startsWith("index.html"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect(existsSync(dir)).toBe(false);
  });
});
