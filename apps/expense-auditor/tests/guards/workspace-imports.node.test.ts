import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Requirements 6.6, 8.7, 19.12: the browser bundle only uses the two allowed
// workspace packages and no Node-only modules; server and shared code never reach into src/.
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SKIPPED_DIRS = new Set(["node_modules", "dist", "__screenshots__"]);
const ALLOWED_WORKSPACE = new Set(["@bones/core", "@bones/xray-ui"]);
const BUILTINS = new Set(builtinModules);

const SPECIFIER =
  /(?:import|export)\s[^"']*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;

export function findSpecifiers(text: string): string[] {
  return [...text.matchAll(SPECIFIER)].map((m) => (m[1] ?? m[2] ?? m[3] ?? m[4])!);
}

function isNodeBuiltin(spec: string): boolean {
  return spec.startsWith("node:") || BUILTINS.has(spec) || BUILTINS.has(spec.split("/")[0]!);
}

export function srcViolations(text: string): string[] {
  const out: string[] = [];
  for (const spec of findSpecifiers(text)) {
    if (spec.startsWith("@bones/") && !ALLOWED_WORKSPACE.has(spec)) out.push(`workspace specifier "${spec}"`);
    else if (isNodeBuiltin(spec)) out.push(`Node specifier "${spec}"`);
  }
  return out;
}

export function reachIntoSrc(relFile: string, text: string): string[] {
  const out: string[] = [];
  const fromDir = dirname(resolve(APP_ROOT, relFile));
  const srcRoot = join(APP_ROOT, "src");
  for (const spec of findSpecifiers(text)) {
    if (!spec.startsWith(".")) continue;
    const target = resolve(fromDir, spec);
    if (target === srcRoot || target.startsWith(srcRoot + "/")) out.push(`imports "${spec}"`);
  }
  return out;
}

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (SKIPPED_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (CODE_EXTENSIONS.has(extname(full))) out.push(full);
  }
}

function collect(dirs: readonly string[]): string[] {
  const files: string[] = [];
  for (const d of dirs) walk(join(APP_ROOT, d), files);
  return files;
}

describe("workspace import guard", () => {
  it("src uses only @bones/core and @bones/xray-ui and no Node modules", () => {
    const files = collect(["src"]);
    expect(files.length).toBeGreaterThan(0);
    const violations = files.flatMap((f) =>
      srcViolations(readFileSync(f, "utf8")).map((v) => `${relative(APP_ROOT, f)}: ${v}`),
    );
    expect(violations).toEqual([]);
  });

  it("shared/ and api/_lib/ import nothing from src/", () => {
    const files = collect(["shared", "api/_lib"]);
    expect(files.length).toBeGreaterThan(0);
    const violations = files.flatMap((f) => {
      const rel = relative(APP_ROOT, f);
      const text = readFileSync(f, "utf8");
      const alias = findSpecifiers(text)
        .filter((s) => s === "src" || s.startsWith("src/") || s.startsWith("/src/"))
        .map((s) => `imports "${s}"`);
      return [...reachIntoSrc(rel, text), ...alias].map((v) => `${rel}: ${v}`);
    });
    expect(violations).toEqual([]);
  });

  it("scanner flags forbidden specifiers", () => {
    expect(srcViolations('import a from "@bones/core/node";')).toHaveLength(1);
    expect(srcViolations('import a from "@bones/other";')).toHaveLength(1);
    expect(srcViolations('import { readFileSync } from "node:fs";')).toHaveLength(1);
    expect(srcViolations('const p = await import("path");')).toHaveLength(1);
    expect(srcViolations('import "fs/promises";')).toHaveLength(1);
    expect(reachIntoSrc("shared/x.ts", 'import a from "../src/a";')).toHaveLength(1);
  });

  it("scanner accepts allowed imports", () => {
    expect(
      srcViolations('import a from "@bones/core";\nimport b from "@bones/xray-ui";\nimport c from "./c";\nimport d from "react";'),
    ).toEqual([]);
    expect(reachIntoSrc("api/_lib/x.ts", 'import a from "../../shared/wire";')).toEqual([]);
  });
});
