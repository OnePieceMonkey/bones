import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, ".."); // packages/xray-ui/src

// "case" is not checked: it is a TypeScript keyword. demo/ is outside src and not scanned.
const FORBIDDEN = /\b(receipt|expense|alcohol|meal|trip|suspect)\b/i;
const EXTENSIONS = [".ts", ".tsx", ".css"];

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== "__tests__" && entry !== "node_modules") out.push(...collect(full));
    } else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

describe("xray-ui domain isolation", () => {
  const files = collect(srcRoot);

  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("contains no domain-specific words in src (excluding __tests__)", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf-8").split("\n");
      lines.forEach((line, i) => {
        const m = FORBIDDEN.exec(line);
        if (m) offenders.push(`${relative(srcRoot, file)}:${i + 1} "${m[0]}"`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
