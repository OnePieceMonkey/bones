// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { FilmClip } from "../../components/FilmClip";
import { sourceMarks } from "../../model/selectors";
import { arbTraceAndAnatomy } from "../helpers/arbitraries";
import { declarations, mergedDeclarations } from "./helpers";

afterEach(cleanup);

// visual-polish-2 task 4.2: mark labels draw no box and stay accessible while hidden (R1.1, R4.6 to R4.8).
const LABEL_SELECTORS = [
  ".xr-cpanel-plaque",
  ".xr-mark-tag",
  ".xr-doctor-title",
  ".xr-pknob-label",
  ".xr-doc .xr-mark-tag",
  ".xr-doc .xr-mark--line",
];
const UNDERLINE_SELECTORS = new Set([".xr-doc .xr-mark--line"]);

function isEmptyBox(value: string): boolean {
  return /^(0|none|transparent|0px)$/.test(value.trim());
}

describe("Property 8: No label selector draws a box", () => {
  it.each(LABEL_SELECTORS)("%s has no border, background or shadow box", (selector) => {
    // Validates: Requirements 1.1, 4.6
    const d = mergedDeclarations(selector);
    for (const [prop, value] of Object.entries(d)) {
      const underline = UNDERLINE_SELECTORS.has(selector);
      if (prop === "border" || prop === "border-top" || prop === "border-left" || prop === "border-right") {
        expect(isEmptyBox(value), `${selector} ${prop}: ${value}`).toBe(true);
      }
      if (prop === "border-bottom") {
        expect(underline && /^(1\.5px|2px) solid var\(--xr-cyan\)$/.test(value), `${selector} ${prop}: ${value}`).toBe(
          !isEmptyBox(value),
        );
      }
      if (prop === "background" || prop === "background-color" || prop === "background-image") {
        expect(isEmptyBox(value), `${selector} ${prop}: ${value}`).toBe(true);
      }
      if (prop === "box-shadow") {
        expect(isEmptyBox(value) || (underline && value.includes("--xr-cyan-glow")), `${selector} ${prop}: ${value}`).toBe(true);
      }
    }
  });

  it("the highlighted underline only widens the bottom border", () => {
    const d = mergedDeclarations('.xr-doc .xr-mark--line[data-highlighted="true"]');
    expect(d["border-bottom-width"]).toBe("2px");
    expect(d["border-bottom"]).toMatch(/solid var\(--xr-cyan\)/);
  });
});

describe("Property 10: Hidden mark label stays accessible", () => {
  it("every rendered mark has exactly one tag with `<tag>: <label>` in the DOM", () => {
    fc.assert(
      fc.property(arbTraceAndAnatomy, fc.string({ maxLength: 120 }), ({ trace, anatomy }, text) => {
        // Validates: Requirements 4.7, 4.8
        cleanup();
        const lineCount = text.split("\n").length;
        const expected = sourceMarks(trace, anatomy, undefined).filter(
          (m) => m.location.kind === "line" && Number.isInteger(m.location.lineIndex) && m.location.lineIndex >= 0 && m.location.lineIndex < lineCount,
        );
        const { container } = render(
          createElement(FilmClip, { trace, anatomy, source: { kind: "text", text } }),
        );
        const tags = [...container.querySelectorAll<HTMLElement>(".xr-mark-tag")];
        expect(tags).toHaveLength(expected.length);
        for (const m of expected) {
          const own = tags.filter((t) => t.getAttribute("data-path") === m.path);
          expect(own).toHaveLength(1);
          expect(own[0]!.textContent).toBe(`${m.tag}: ${m.label}`);
        }
      }),
      { numRuns: 40 },
    );
  });

  it("hides the tag by opacity only, shows it on hover and highlight, and has a reduced-motion entry", () => {
    const rules = declarations().filter((d) => d.file === "panels.css" && d.selector === ".xr-doc .xr-mark-tag");
    const tag: Record<string, string> = {};
    for (const d of rules) if (!(d.property === "transition" && d.value === "none")) tag[d.property] = d.value;
    expect(rules.some((d) => d.property === "transition" && d.value === "none")).toBe(true);
    expect(tag["opacity"]).toBe("0");
    expect(tag["transition"]).toBe("opacity 150ms ease");
    expect(tag["font-family"]).toBe("var(--xr-font-sans)");
    expect(tag["white-space"]).toBe("nowrap");
    expect(tag["max-width"]).toBe("100%");
    expect(tag["display"]).not.toBe("none");
    expect(tag["visibility"]).toBeUndefined();
    expect(mergedDeclarations(".xr-doc .xr-mark:hover .xr-mark-tag")["opacity"]).toBe("1");
    expect(mergedDeclarations('.xr-doc .xr-mark-tag[data-highlighted="true"]')["opacity"]).toBe("1");
  });
});
