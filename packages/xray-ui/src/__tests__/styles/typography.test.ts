import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { declarations, readStyles, type Declaration, type StyleFile } from "./helpers";

const FONT_TOKENS = ["var(--xr-font-serif)", "var(--xr-font-sans)", "var(--xr-font-mono)"];
const SERIF_SELECTORS = new Set([".xr-wordmark", ".xr-start-title"]);
const MONO_PREFIXES = [".xr-doc", ".xr-sheet-line"];
const LINE_PROPS = /^(border|outline)(-(top|right|bottom|left))?(-style)?$/;

/** Returns a message for each declaration that breaks the dashed/dotted or font-role rule. */
export function checkDeclaration(d: Declaration): string[] {
  const where = `${d.file} ${d.selector} { ${d.property}: ${d.value} }`;
  const out: string[] = [];
  if (LINE_PROPS.test(d.property) && /\b(dashed|dotted)\b/.test(d.value)) out.push(`dashed/dotted: ${where}`);
  if (d.property === "font-family" && !FONT_TOKENS.includes(d.value)) out.push(`font-family not a token: ${where}`);
  if (d.property === "font" && /monospace|Menlo|Consolas|Cormorant/i.test(d.value)) out.push(`font shorthand names a family: ${where}`);
  if (d.value.includes("--xr-font-serif") && d.property === "font-family" && !SERIF_SELECTORS.has(d.selector)) {
    out.push(`serif outside wordmark/headline: ${where}`);
  }
  if (d.value.includes("--xr-font-mono") && !MONO_PREFIXES.some((p) => d.selector.startsWith(p))) {
    out.push(`mono outside the paper: ${where}`);
  }
  return out;
}

/** The @font-face block declares the family name itself, so it is not a use of a font role. */
const decls = (files: StyleFile[]) => declarations(files).filter((d) => d.selector !== "@font-face");

describe("typography and line styles", () => {
  // Feature: visual-polish-2, Property 9: No dashed or dotted style and one font per role
  // **Validates: Requirements 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4**
  it("every declaration in styles/*.css keeps one font per role and no dashed or dotted line", () => {
    const all = decls(readStyles());
    expect(all.length).toBeGreaterThan(100);
    fc.assert(
      fc.property(fc.constantFrom(...all), (d) => {
        expect(checkDeclaration(d)).toEqual([]);
      }),
      { numRuns: Math.max(100, all.length) },
    );
    // Exhaustive pass as well, so no declaration escapes the sampling.
    expect(all.flatMap(checkDeclaration)).toEqual([]);
  });

  it("serif is used by the wordmark and the start headline only", () => {
    const users = declarations(readStyles()).filter((d) => d.property === "font-family" && d.value.includes("--xr-font-serif"));
    expect(users.map((d) => d.selector).sort()).toEqual([".xr-start-title", ".xr-wordmark"]);
  });

  it("flags a dashed border and a stray monospace family", () => {
    const bad = (selector: string, property: string, value: string): Declaration => ({ file: "x.css", selector, property, value });
    expect(checkDeclaration(bad(".a", "border", "2px dashed red"))).toHaveLength(1);
    expect(checkDeclaration(bad(".a", "font", "500 12px / 1.2 ui-monospace, monospace"))).toHaveLength(1);
    expect(checkDeclaration(bad(".a", "font-family", "ui-monospace, Menlo, monospace"))).toHaveLength(1);
    expect(checkDeclaration(bad(".xr-doc .xr-film-text", "font-family", "var(--xr-font-mono)"))).toEqual([]);
    expect(checkDeclaration(bad(".b", "font-family", "var(--xr-font-mono)"))).toHaveLength(1);
  });
});
