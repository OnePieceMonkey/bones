import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { useEffect } from "react";
import type { Trace } from "@bones/core";
import { FilmClip } from "../../components/FilmClip";
import { HoveredRuleProvider, useHoveredRule } from "../../hooks/useHoveredRule";
import type { FilmSource } from "../../types";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

const TEXT = "Trattoria Roma\n2024-05-14\nWine 6.50\nTotal 480.00";

/** Trace with line sources for merchant/date/alcohol and a bbox for the total. */
function textTrace(): Trace {
  return {
    ...signatureTrace(),
    sources: {
      "receipt.merchant": { kind: "line", lineIndex: 0 },
      "receipt.date": { kind: "line", lineIndex: 1 },
      "receipt.alcoholCents": { kind: "line", lineIndex: 2 },
      "receipt.totalCents": { kind: "bbox", x: 0.1, y: 0.2, width: 0.5, height: 0.05 },
    },
  };
}

function imageTrace(): Trace {
  return {
    ...signatureTrace(),
    sources: {
      "receipt.merchant": { kind: "bbox", x: 0.1, y: 0.25, width: 0.5, height: 0.125 },
      "receipt.date": { kind: "line", lineIndex: 1 },
      "receipt.totalCents": { kind: "bbox", x: 0, y: 0.5, width: 1, height: 0.1 },
    },
  };
}

const textSource: FilmSource = { kind: "text", text: TEXT };
const imageSource: FilmSource = { kind: "image", src: "/receipt.png", alt: "Receipt photo" };

function ui(trace: Trace, source: FilmSource, activeRuleId?: string | null) {
  const extra = activeRuleId === undefined ? {} : { activeRuleId };
  return <FilmClip trace={trace} anatomy={signatureAnatomy()} source={source} {...extra} />;
}

function highlightedPaths(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('.xr-mark-tag[data-highlighted="true"], .xr-mark--bbox[data-highlighted="true"]')]
    .map((el) => el.getAttribute("data-path") ?? el.closest("[data-path]")?.getAttribute("data-path") ?? "")
    .filter((p) => p !== "")
    .sort();
}

describe("FilmClip", () => {
  it("draws two clips on the film", () => {
    const { container } = render(ui(textTrace(), textSource));
    expect(container.querySelectorAll(".xr-clip")).toHaveLength(2);
    expect(container.querySelector("figure.xr-film")).toHaveAttribute("aria-label", "Source input");
  });

  it("renders text sources as one xr-film-line span per line", () => {
    const { container } = render(ui(textTrace(), textSource));
    const lines = container.querySelectorAll<HTMLElement>("span.xr-film-line");
    expect(lines).toHaveLength(4);
    expect([...lines].map((l) => l.getAttribute("data-line"))).toEqual(["0", "1", "2", "3"]);
    expect(lines[0]?.textContent).toContain("Trattoria Roma");
    expect(lines[3]?.textContent).toContain("Total 480.00");
  });

  it("renders image sources with src and alt", () => {
    const { container } = render(ui(imageTrace(), imageSource));
    const img = container.querySelector("img.xr-film-image");
    expect(img).toHaveAttribute("src", "/receipt.png");
    expect(img).toHaveAttribute("alt", "Receipt photo");
  });

  it("positions bbox marks in percent of the image", () => {
    const { container } = render(ui(imageTrace(), imageSource));
    const box = container.querySelector<HTMLElement>('.xr-mark--bbox[data-path="receipt.merchant"]');
    expect(box?.style.left).toBe("10%");
    expect(box?.style.top).toBe("25%");
    expect(box?.style.width).toBe("50%");
    expect(box?.style.height).toBe("12.5%");
  });

  it("marks the line at lineIndex and leaves other lines unmarked", () => {
    const { container } = render(ui(textTrace(), textSource));
    const marked = [...container.querySelectorAll<HTMLElement>("span.xr-film-line.xr-mark--line")];
    expect(marked.map((l) => l.getAttribute("data-line"))).toEqual(["0", "1", "2"]);
    const unmarked = container.querySelector('span.xr-film-line[data-line="3"]');
    expect(unmarked).not.toHaveClass("xr-mark");
    expect(unmarked).not.toHaveAttribute("data-highlighted");
  });

  it("shows tag labels with number and field label", () => {
    const { container } = render(ui(textTrace(), textSource));
    const tags = [...container.querySelectorAll(".xr-mark-tag")].map((t) => t.textContent);
    expect(tags).toHaveLength(3);
    expect(tags[0]).toBe("1: Merchant");
    expect(tags[1]).toBe("2: Date");
    expect(tags[2]).toMatch(/^3: /);
    const img = render(ui(imageTrace(), imageSource));
    const imgTags = [...img.container.querySelectorAll(".xr-mark-tag")].map((t) => t.textContent);
    expect(imgTags).toContain("1: Merchant");
    expect(imgTags.some((t) => t?.endsWith("Total"))).toBe(true);
  });

  it("highlights exactly the related marks for activeRuleId", () => {
    const { container } = render(ui(textTrace(), textSource, "date-blocking-after"));
    expect(highlightedPaths(container)).toEqual(["receipt.date"]);
    expect(container.querySelector('span.xr-film-line[data-line="1"]')).toHaveAttribute("data-highlighted", "true");
    expect(container.querySelector('span.xr-film-line[data-line="0"]')).toHaveAttribute("data-highlighted", "false");
    expect(container.querySelector('span.xr-film-line[data-line="2"]')).toHaveAttribute("data-highlighted", "false");
  });

  it("highlights a bbox mark for a rule whose evidence is a bbox field", () => {
    const { container } = render(ui(imageTrace(), imageSource, "meal-limit"));
    expect(container.querySelector('.xr-mark--bbox[data-path="receipt.totalCents"]')).toHaveAttribute("data-highlighted", "true");
    expect(container.querySelector('.xr-mark--bbox[data-path="receipt.merchant"]')).toHaveAttribute("data-highlighted", "false");
  });

  it("highlights nothing without an active rule or for an unknown rule", () => {
    expect(highlightedPaths(render(ui(textTrace(), textSource)).container)).toEqual([]);
    expect(highlightedPaths(render(ui(textTrace(), textSource, "nope")).container)).toEqual([]);
  });

  it("follows the hovered rule from HoveredRuleProvider", () => {
    function Hover({ id }: { id: string }) {
      const { setHoveredRuleId } = useHoveredRule();
      useEffect(() => setHoveredRuleId(id), [id, setHoveredRuleId]);
      return null;
    }
    const { container } = render(
      <HoveredRuleProvider>
        <Hover id="alcohol-deducting" />
        {ui(textTrace(), textSource)}
      </HoveredRuleProvider>,
    );
    expect(highlightedPaths(container)).toEqual(["receipt.alcoholCents"]);
    expect(container.querySelector('span.xr-film-line[data-line="2"]')).toHaveAttribute("data-highlighted", "true");
  });

  it("lets activeRuleId override the hovered rule", () => {
    function Hover() {
      const { setHoveredRuleId } = useHoveredRule();
      useEffect(() => setHoveredRuleId("alcohol-deducting"), [setHoveredRuleId]);
      return null;
    }
    const { container } = render(
      <HoveredRuleProvider>
        <Hover />
        {ui(textTrace(), textSource, "date-blocking-after")}
      </HoveredRuleProvider>,
    );
    expect(highlightedPaths(container)).toEqual(["receipt.date"]);
  });

  it("draws no box for a field whose source is undefined", () => {
    const trace = imageTrace();
    const sources = { ...trace.sources, "receipt.totalCents": undefined } as unknown as Trace["sources"];
    const { container } = render(ui({ ...trace, sources }, imageSource));
    expect(container.querySelectorAll(".xr-mark--bbox")).toHaveLength(1);
    expect(container.querySelector('[data-path="receipt.totalCents"]')).toBeNull();
  });

  it("skips bbox sources on text films and line sources on image films", () => {
    const text = render(ui(textTrace(), textSource));
    expect(text.container.querySelector(".xr-mark--bbox")).toBeNull();
    expect(text.container.querySelector('[data-path="receipt.totalCents"]')).toBeNull();
    const image = render(ui(imageTrace(), imageSource));
    expect(image.container.querySelector('[data-path="receipt.date"]')).toBeNull();
    expect(image.container.querySelector("span.xr-film-line")).toBeNull();
  });
});
