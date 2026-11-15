import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { builtinModules } from "node:module";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Matches static imports, re-exports and dynamic imports with a string literal.
const SPECIFIER = /(?:import|export)\s[^"']*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

const BUILTINS = new Set(builtinModules.flatMap((m) => [m, m.split("/")[0] as string]));

function isNodeBuiltin(spec: string): boolean {
  return spec.startsWith("node:") || BUILTINS.has(spec);
}

function resolveRelative(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  const candidates = [base.replace(/\.js$/, ".ts"), base + ".ts", join(base, "index.ts")];
  return candidates.find((c) => existsSync(c)) ?? null;
}

/** Collects every file reachable from `entry` through relative imports and the Node built-ins they import. */
function walk(entry: string) {
  const files = new Set<string>();
  const builtins: { file: string; spec: string }[] = [];
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    const text = readFileSync(file, "utf-8");
    for (const m of text.matchAll(SPECIFIER)) {
      const spec = (m[1] ?? m[2] ?? m[3]) as string;
      if (spec.startsWith(".")) {
        const next = resolveRelative(file, spec);
        if (next === null) throw new Error(`Cannot resolve "${spec}" imported by ${file}`);
        queue.push(next);
      } else if (isNodeBuiltin(spec)) {
        builtins.push({ file: file.slice(srcRoot.length + 1), spec });
      }
    }
  }
  return { files, builtins };
}

describe("browser-safe barrel: src/index.ts must not reach a Node built-in", () => {
  it("walks a non-trivial import graph from src/index.ts", () => {
    const { files } = walk(join(srcRoot, "index.ts"));
    expect(files.size).toBeGreaterThan(5);
  });

  it("no file reachable from src/index.ts imports a node: module or Node built-in", () => {
    const { builtins } = walk(join(srcRoot, "index.ts"));
    expect(builtins).toEqual([]);
  });

  it("the Node-only adapter stays reachable from src/node.ts and not from src/index.ts", () => {
    const fromIndex = walk(join(srcRoot, "index.ts")).files;
    const fromNode = walk(join(srcRoot, "node.ts"));
    const recorded = join(srcRoot, "extraction", "recorded.ts");
    expect(fromIndex.has(recorded)).toBe(false);
    expect(fromNode.files.has(recorded)).toBe(true);
    expect(fromNode.builtins.map((b) => b.spec)).toContain("node:fs/promises");
  });
});
