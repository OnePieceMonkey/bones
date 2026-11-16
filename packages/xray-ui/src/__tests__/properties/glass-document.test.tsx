// Feature: visual-polish, Property 18: Document marks follow the hovered rule
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import { cleanup, render } from "@testing-library/react";
import type { Trace } from "@bones/core";
import { GlassCard } from "../../components/panels/GlassCard";
import { HoveredRuleProvider, useHoveredRule } from "../../hooks/useHoveredRule";
import { DocumentPanel } from "../../components/panels/DocumentPanel";
import { FilmClip } from "../../components/FilmClip";
import { fieldViews, relatedFields, selectBones } from "../../model/selectors";
import type { FilmSource } from "../../types";
import { arbTraceAndAnatomy } from "../helpers/arbitraries";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

afterEach(cleanup);

const TEXT = "Trattoria Roma\n2024-05-14\nWine 6.50\nTotal 480.00";
const textSource: FilmSource = { kind: "text", text: TEXT };

function highlighted(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('.xr-mark-tag[data-highlighted="true"]')]
    .map((el) => el.getAttribute("data-path") ?? "")
    .sort();
}

describe("Property 18: document marks follow the hovered rule", () => {
  it("highlights exactly the related fields' marks, and scan lines equal overruled fields with a rendered source", () => {
    fc.assert(
      fc.property(arbTraceAndAnatomy, fc.nat(20), fc.string({ maxLength: 120 }), ({ trace, anatomy }, pick, text) => {
        // Validates: Requirements 6.3, 6.5, 6.6, 11.8
        const bones = selectBones(trace, anatomy);
        const active = bones.length > 0 ? bones[pick % bones.length] : undefined;
        const source: FilmSource = { kind: "text", text };
        const lineCount = text.split("\n").length;
        const { container } = render(
          <FilmClip
            trace={trace}
            anatomy={anatomy}
            source={source}
            scanOverruled
            activeRuleId={active?.ruleId ?? null}
          />,
        );
        const related = new Set(active ? relatedFields(active) : []);
        const withSource = Object.entries(trace.sources)
          .filter(([, loc]) => loc !== undefined)
          .map(([p]) => p);
        // Text films render only in-range line sources.
        const rendered = withSource.filter((p) => {
          const loc = trace.sources[p];
          return loc?.kind === "line" && Number.isInteger(loc.lineIndex) && loc.lineIndex < lineCount;
        });
        const expectedMarks = rendered.filter((p) => related.has(p)).sort();
        expect(highlighted(container)).toEqual(expectedMarks);

        const overruled = new Set(fieldViews(trace, anatomy, bones).filter((f) => f.overruled).map((f) => f.path));
        const expectedScans = rendered.filter((p) => overruled.has(p)).sort();
        const scans = [...container.querySelectorAll<HTMLElement>(".xr-scan")].map((e) => e.getAttribute("data-path"));
        expect(scans.sort()).toEqual(expectedScans);
        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it("without a hovered rule nothing is highlighted", () => {
    const { container } = render(
      <DocumentPanel trace={signatureTrace()} anatomy={signatureAnatomy()} source={textSource} />,
    );
    expect(highlighted(container)).toEqual([]);
  });
});

function textTrace(): Trace {
  const base = signatureTrace();
  return {
    ...base,
    // The alcohol bone is fractured in the fixture, so this field is overruled.
    proposedFields: { ...base.proposedFields, "receipt.alcoholCents": 650 },
    sources: {
      "receipt.merchant": { kind: "line", lineIndex: 0 },
      "receipt.date": { kind: "line", lineIndex: 1 },
      "receipt.alcoholCents": { kind: "line", lineIndex: 2 },
    },
  };
}

describe("DocumentPanel", () => {
  it("renders exactly two clips, a scrollable text region and the paper wrapper", () => {
    const { container, getByRole } = render(
      <DocumentPanel trace={textTrace()} anatomy={signatureAnatomy()} source={textSource} />,
    );
    expect(container.querySelectorAll(".xr-clip")).toHaveLength(2);
    expect(container.querySelector(".xr-doc-paper")).not.toBeNull();
    const region = getByRole("region", { name: "Document content" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region.querySelectorAll("span.xr-film-line")).toHaveLength(4);
  });

  it("draws scan lines for overruled fields with a known source and none for unknown sources", () => {
    const trace = textTrace();
    const bones = selectBones(trace, signatureAnatomy());
    const overruled = fieldViews(trace, signatureAnatomy(), bones).filter((f) => f.overruled);
    expect(overruled.length).toBeGreaterThan(0);
    const { container } = render(<DocumentPanel trace={trace} anatomy={signatureAnatomy()} source={textSource} />);
    const expected = overruled.filter((f) => trace.sources[f.path] !== undefined).length;
    expect(container.querySelectorAll(".xr-scan")).toHaveLength(expected);

    const bare = render(
      <DocumentPanel trace={{ ...trace, sources: {} }} anatomy={signatureAnatomy()} source={textSource} />,
    );
    expect(bare.container.querySelectorAll(".xr-scan")).toHaveLength(0);
    expect(bare.container.querySelectorAll("span.xr-film-line")).toHaveLength(4);
  });

  it("shows an image source inside the paper area", () => {
    const { container } = render(
      <DocumentPanel
        trace={textTrace()}
        anatomy={signatureAnatomy()}
        source={{ kind: "image", src: "/x.png", alt: "Photo" }}
      />,
    );
    expect(container.querySelector(".xr-doc-paper img.xr-film-image")).toHaveAttribute("alt", "Photo");
  });

  it("FilmClip draws no scan lines by default", () => {
    const { container } = render(
      <FilmClip trace={textTrace()} anatomy={signatureAnatomy()} source={textSource} />,
    );
    expect(container.querySelectorAll(".xr-scan")).toHaveLength(0);
  });
});

// Feature: visual-polish, Property 17: Glass card shows cracks and exactly one stamp when something is overruled
describe("Property 17: glass card cracks and stamp", () => {
  it("shows cracks and exactly one stamp iff a field is overruled", () => {
    fc.assert(
      fc.property(arbTraceAndAnatomy, ({ trace, anatomy }) => {
        // Validates: Requirements 7.3, 7.4, 7.5, 7.6, 7.9
        const bones = selectBones(trace, anatomy);
        const views = fieldViews(trace, anatomy, bones);
        const overruled = views.filter((f) => f.overruled);
        const { container } = render(<GlassCard trace={trace} anatomy={anatomy} showUnlabelled />);
        const stamps = container.querySelectorAll(".xr-stamp");
        const cracks = container.querySelectorAll(".xr-cracks");
        if (overruled.length === 0) {
          expect(stamps).toHaveLength(0);
          expect(cracks).toHaveLength(0);
        } else {
          expect(cracks).toHaveLength(1);
          expect(stamps).toHaveLength(1);
          const first = bones.find(
            (b) => b.state === "fractured" && overruled.some((f) => f.overruledBy.includes(b.label)),
          );
          const text = stamps[0]?.textContent ?? "";
          expect(text).toContain("OVERRULED BY RULE");
          if (first) expect(text).toContain(`${first.label}${first.version !== null ? ` ${first.version}` : ""}`);
        }
        const rows = [...container.querySelectorAll('.xr-field[data-overruled="true"]')];
        expect(rows).toHaveLength(overruled.length);
        for (const r of rows) expect(r.textContent).toContain("OVERRULED");
        cleanup();
      }),
      { numRuns: 100 },
    );
  });
});

describe("GlassCard", () => {
  it("has no cracks and no stamp when nothing is overruled", () => {
    const trace = signatureTrace();
    const { container } = render(<GlassCard trace={{ ...trace, ruleOutcomes: [] }} anatomy={signatureAnatomy()} />);
    expect(container.querySelector(".xr-cracks")).toBeNull();
    expect(container.querySelector(".xr-stamp")).toBeNull();
  });

  it("keeps the article and note roles and links rows to the hovered rule", () => {
    const trace = textTrace();
    const anatomy = signatureAnatomy();
    const bone = selectBones(trace, anatomy).find((b) => relatedFields(b).includes("receipt.alcoholCents"));
    expect(bone).toBeDefined();
    const { getByRole } = render(
      <HoveredRuleProvider>
        <Hover id={bone!.ruleId} />
        <GlassCard trace={trace} anatomy={anatomy} showUnlabelled />
      </HoveredRuleProvider>,
    );
    expect(getByRole("article", { name: "AI answer" })).toBeInTheDocument();
    expect(getByRole("note")).toHaveTextContent("OVERRULED BY RULE");
    const linked = relatedFields(bone!);
    const rows = document.querySelectorAll('.xr-field[data-linked="true"]');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(linked).toContain(r.getAttribute("data-path"));
  });

  it("styles: stamp rotation 5..12 degrees and blur 4..16 px", () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../styles/panels.css"), "utf8");
    const rot = /\.xr-glass-stamp\s*\{[^}]*rotate\((-?\d+(?:\.\d+)?)deg\)/.exec(css);
    expect(rot).not.toBeNull();
    expect(Math.abs(Number(rot![1]))).toBeGreaterThanOrEqual(5);
    expect(Math.abs(Number(rot![1]))).toBeLessThanOrEqual(12);
    const blur = /\.xr-glass\s*\{[^}]*?[^-]backdrop-filter:\s*blur\((\d+)px\)/.exec(css);
    expect(blur).not.toBeNull();
    expect(Number(blur![1])).toBeGreaterThanOrEqual(4);
    expect(Number(blur![1])).toBeLessThanOrEqual(16);
    expect(css).toMatch(/@supports not/);
  });
});

function Hover({ id }: { id: string }) {
  const { setHoveredRuleId } = useHoveredRule();
  useEffect(() => setHoveredRuleId(id), [id, setHoveredRuleId]);
  return null;
}
