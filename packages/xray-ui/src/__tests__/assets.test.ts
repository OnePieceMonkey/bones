import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const assetDir = join(here, "..", "assets");
const designDir = join(here, "..", "..", "..", "..", "design", "assets");

export const ASSET_BUDGET = 1_500_000;

export interface AssetEntry {
  path: string; // relative to the asset dir, forward slashes
  size: number;
}

/** Pure check: returns failure messages (empty when the listing is fine). */
export function checkAssets(
  listing: readonly AssetEntry[],
  expected: readonly string[],
  budget: number,
): string[] {
  const problems: string[] = [];
  const have = new Set(listing.map((e) => e.path));
  const missing = expected.filter((n) => !have.has(n));
  if (missing.length > 0) problems.push(`missing asset files: ${missing.join(", ")}`);
  const total = listing.reduce((sum, e) => sum + e.size, 0);
  if (total > budget) problems.push(`asset total ${total} bytes exceeds budget ${budget} bytes`);
  return problems;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function listing(dir: string, skip: (rel: string) => boolean = () => false): AssetEntry[] {
  return walk(dir)
    .map((f) => ({ path: relative(dir, f).split("\\").join("/"), size: statSync(f).size }))
    .filter((e) => !skip(e.path));
}

/** File names from design/assets/README.md, with the paper rename applied. */
function expectedFromReadme(): string[] {
  const readme = readFileSync(join(designDir, "README.md"), "utf8");
  const names: string[] = [];
  for (const m of readme.matchAll(/^\| `([^`]+)`/gm)) {
    const name = m[1] as string;
    if (name === "splinters/splinter-1..8.webp") {
      for (let i = 1; i <= 8; i++) names.push(`splinters/splinter-${i}.webp`);
    } else if (name.endsWith(".webp")) {
      names.push(name === "receipt-paper.webp" ? "paper.webp" : name);
    }
  }
  return names;
}

describe("asset bundle", () => {
  const actual = listing(assetDir, (p) => p === "index.ts");
  const expected = expectedFromReadme();

  it("README lists 22 images", () => {
    expect(expected).toHaveLength(22);
  });

  it("contains every file listed in design/assets/README.md", () => {
    const missing = expected.filter((n) => !actual.some((a) => a.path === n));
    expect(missing, `missing asset files: ${missing.join(", ")}`).toEqual([]);
  });

  it("is byte-identical to design/assets (paper renamed)", () => {
    const diffs: string[] = [];
    for (const name of expected) {
      const src = name === "paper.webp" ? "receipt-paper.webp" : name;
      const a = readFileSync(join(assetDir, name));
      const b = readFileSync(join(designDir, src));
      if (!a.equals(b)) diffs.push(name);
    }
    expect(diffs).toEqual([]);
  });

  it("does not contain receipt-paper.webp", () => {
    expect(actual.some((a) => a.path === "receipt-paper.webp")).toBe(false);
  });

  it("contains no unexpected files", () => {
    const extra = actual.map((a) => a.path).filter((p) => !expected.includes(p));
    expect(extra).toEqual([]);
  });

  it("index.ts exports exactly one URL per image file", () => {
    const src = readFileSync(join(assetDir, "index.ts"), "utf8");
    const imported = [...src.matchAll(/from "\.\/([^"]+\.webp)"/g)].map((m) => m[1] as string);
    expect([...imported].sort()).toEqual([...expected].sort());
    const exported = [...src.matchAll(/^\s+(\w+Url),$/gm)].map((m) => m[1] as string);
    expect(exported.slice(0, expected.length)).toHaveLength(expected.length);
    expect(src).toContain("export const SPLINTER_URLS");
  });

  it("fits the asset budget", () => {
    const total = actual.reduce((s, e) => s + e.size, 0);
    expect(total, `asset total ${total} bytes exceeds budget ${ASSET_BUDGET} bytes`).toBeLessThanOrEqual(
      ASSET_BUDGET,
    );
  });
});

describe("checkAssets", () => {
  it("names every missing file", () => {
    const msgs = checkAssets([{ path: "a.webp", size: 1 }], ["a.webp", "b.webp", "c.webp"], 100);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain("b.webp");
    expect(msgs[0]).toContain("c.webp");
  });

  it("reports measured bytes and the budget", () => {
    const msgs = checkAssets([{ path: "a.webp", size: 2_000_000 }], ["a.webp"], ASSET_BUDGET);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain("2000000");
    expect(msgs[0]).toContain("1500000");
  });

  it("passes a good listing", () => {
    expect(checkAssets([{ path: "a.webp", size: 10 }], ["a.webp"], 100)).toEqual([]);
  });
});
