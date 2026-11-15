import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, ".."); // packages/core/src (one level up from __tests__)

// Forbidden domain-specific terms (word-boundary matched, case-insensitive).
// Note: "case" is intentionally omitted because it is also a TypeScript keyword
// used in switch statements throughout the source.
const FORBIDDEN_TERMS = ["expense", "receipt", "alcohol", "meal", "trip", "suspect"];

/** Recursively collect all .ts files under a directory, excluding __tests__ subdirs */
function collectSrcFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry !== "__tests__" && entry !== "node_modules") {
        files.push(...collectSrcFiles(fullPath));
      }
    } else if (entry.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Domain isolation: src/ files must not contain domain-specific identifiers", () => {
  const srcFiles = collectSrcFiles(srcRoot);

  it("finds source files to check", () => {
    expect(srcFiles.length).toBeGreaterThan(0);
  });

  it("no src file references rules/expense-auditor", () => {
    const offenders = srcFiles.filter((f) =>
      readFileSync(f, "utf-8").includes("rules/expense-auditor"),
    );
    expect(offenders).toEqual([]);
  });

  for (const filePath of srcFiles) {
    const relPath = relative(srcRoot, filePath);
    const content = readFileSync(filePath, "utf-8");

    it(`${relPath}: no forbidden domain terms`, () => {
      for (const term of FORBIDDEN_TERMS) {
        const regex = new RegExp(`\\b${term}\\b`, "i");
        const match = content.match(regex);
        if (match) {
          throw new Error(`File ${relPath} contains forbidden term "${term}"`);
        }
      }
    });

    it(`${relPath}: does not import from test-fixtures/`, () => {
      expect(content).not.toContain("test-fixtures");
    });
  }
});
