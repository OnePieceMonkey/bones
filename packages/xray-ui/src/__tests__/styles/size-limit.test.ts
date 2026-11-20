import { describe, it, expect } from "vitest";
import { declarations, readStyles, type StyleFile } from "./helpers";

const LIMIT = 120;
/** Selectors (prefix match) that may exceed the limit: the new control panel parts. */
const EXEMPT_PREFIXES = [".xr-pknob", ".xr-pmeter", ".xr-cpanel"];
/** These predate visual-polish-2 and keep their sizes. */
const ALLOW_LIST = new Set([
  ".xr-sheet",
  ".xr-sheet-paper",
  ".xr-sheet-thumb",
  ".xr-rulebox",
  ".xr-burst",
]);

export interface Violation {
  readonly file: string;
  readonly selector: string;
  readonly number: number;
}

export function findOversize(files: StyleFile[], limit = LIMIT): Violation[] {
  const out: Violation[] = [];
  for (const d of declarations(files)) {
    if (EXEMPT_PREFIXES.some((p) => d.selector.startsWith(p))) continue;
    if (ALLOW_LIST.has(d.selector)) continue;
    for (const m of d.value.matchAll(/calc\((\d+(?:\.\d+)?) \*/g)) {
      const n = Number(m[1]);
      if (n > limit) out.push({ file: d.file, selector: d.selector, number: n });
    }
  }
  return out;
}

describe("120 u size guard", () => {
  it("styles/*.css has no calc(N * ...) above 120 outside the exempt selectors", () => {
    const bad = findOversize(readStyles());
    expect(bad.map((v) => `${v.file} ${v.selector}: ${v.number} > ${LIMIT}`)).toEqual([]);
  });
  it("flags a bad sample with file, selector and number", () => {
    const files = [{ file: "x.css", source: ".xr-big { width: calc(121 * var(--xr-u, 1px)); }" }];
    expect(findOversize(files)).toEqual([{ file: "x.css", selector: ".xr-big", number: 121 }]);
  });
  it("accepts a clean sample, the limit itself and exempt selectors", () => {
    const files = [
      {
        file: "y.css",
        source: ".a { width: calc(120 * var(--xr-u, 1px)); }\n.xr-pknob-dial { width: calc(300 * var(--xr-u, 1px)); }\n/* .b { width: calc(999 * x) } */",
      },
    ];
    expect(findOversize(files)).toEqual([]);
  });
});
