import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// Vercel compiles api/*.ts file by file in an ESM package: relative specifiers must end in '.js'.
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const SPECIFIER_RES: RegExp[] = [
  /\bfrom\s*["'](\.{1,2}\/[^"']*)["']/g,
  /\bimport\s*["'](\.{1,2}\/[^"']*)["']/g,
  /\bimport\s*\(\s*["'](\.{1,2}\/[^"']*)["']\s*\)/g,
];

/** Relative specifiers that do not end in '.js'. */
export function badSpecifiers(source: string): string[] {
  const bad: string[] = [];
  for (const re of SPECIFIER_RES) {
    for (const m of source.matchAll(re)) {
      const spec = m[1] ?? "";
      if (!spec.endsWith(".js")) bad.push(spec);
    }
  }
  return bad;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("api import extensions guard", () => {
  it("flags extensionless and .ts specifiers (bad samples)", () => {
    expect(badSpecifiers('import { a } from "./x";')).toEqual(["./x"]);
    expect(badSpecifiers('import type { A } from "../x.ts";')).toEqual(["../x.ts"]);
    expect(badSpecifiers('export * from "./x";')).toEqual(["./x"]);
    expect(badSpecifiers('const m = await import("./x");')).toEqual(["./x"]);
    expect(badSpecifiers('import "./x";')).toEqual(["./x"]);
    expect(badSpecifiers('import { a } from "./x.js"; import b from "zod";')).toEqual([]);
  });

  it("every relative specifier in api/** and shared/*.ts ends in .js", () => {
    const files = [...walk(join(APP_ROOT, "api")), ...walk(join(APP_ROOT, "shared"))];
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect({ file: f, bad: badSpecifiers(readFileSync(f, "utf8")) }).toEqual({ file: f, bad: [] });
    }
  });
});
