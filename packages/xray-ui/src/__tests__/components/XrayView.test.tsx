import { describe, it, expect, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Trace } from "@bones/core";
import { XrayView } from "../../components/XrayView";
import type { FilmSource, XrayViewProps } from "../../types";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

const TEXT = "Trattoria Roma\n2024-05-14\nWine 6.50\nTotal 480.00";
const source: FilmSource = { kind: "text", text: TEXT };

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj as Record<string, unknown>)) deepFreeze(v);
  }
  return obj;
}

/** Signature trace with sources for the evidence keys of both fractured bones. */
function sourcedTrace(): Trace {
  return {
    ...signatureTrace(),
    sources: {
      "receipt.merchant": { kind: "line", lineIndex: 0 },
      "receipt.date": { kind: "line", lineIndex: 1 },
      "receipt.alcoholCents": { kind: "line", lineIndex: 2 },
      "receipt.lineItems.0.amountCents": { kind: "line", lineIndex: 3 },
    },
  };
}

function props(overrides: Partial<XrayViewProps> = {}): XrayViewProps {
  return {
    trace: signatureTrace(),
    anatomy: signatureAnatomy(),
    source,
    versions: ["v1", "v2", "v3"],
    version: "v1",
    onVersionChange: () => {},
    reducedMotion: true,
    ...overrides,
  };
}

const boneButton = (ruleId: string): HTMLElement => {
  const el = document.querySelector<HTMLElement>(`button.xr-bone-btn[data-rule-id="${ruleId}"]`);
  if (!el) throw new Error(`no bone button for ${ruleId}`);
  return el;
};

const boneButtons = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>("button.xr-bone-btn")];

function highlightedPaths(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('.xr-mark-tag[data-highlighted="true"]')]
    .map((el) => el.getAttribute("data-path") ?? "")
    .sort();
}

describe("XrayView", () => {
  it("renders all parts", () => {
    const anatomy = signatureAnatomy();
    const { container } = render(<XrayView {...props({ anatomy, title: "Receipt" })} />);
    expect(screen.getByText("X-RAY ON")).toBeInTheDocument();
    expect(boneButtons()).toHaveLength(anatomy.bones.length);
    expect(container.querySelector(".xr-ecg")).not.toBeNull();
    expect(container.querySelector("figure.xr-film")).toHaveAttribute("aria-label", "Source input");
    expect(screen.getByRole("article", { name: "AI answer" })).toBeInTheDocument();
    expect(screen.getByRole("log")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Controls" });
    expect(group).toContainElement(screen.getByRole("slider", { name: "RULE VERSION" }));
    expect(group).toContainElement(screen.getByRole("meter", { name: "AI READ CONFIDENCE" }));
    expect(group).toContainElement(screen.getByRole("switch"));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("hides skeleton and ECG when xray is false but keeps film and answer card (plain)", () => {
    const { container } = render(<XrayView {...props({ xray: false })} />);
    expect(boneButtons()).toHaveLength(0);
    expect(container.querySelector(".xr-ecg")).toBeNull();
    expect(screen.getByText("Skeleton hidden")).toBeInTheDocument();
    expect(screen.getByText("X-RAY OFF")).toBeInTheDocument();
    expect(container.querySelector("figure.xr-film")).toHaveClass("xr--plain");
    expect(screen.getByRole("article", { name: "AI answer" })).toHaveClass("xr--plain");
  });

  it("shows skeleton and ECG when xray is true, without the plain class", () => {
    const { container } = render(<XrayView {...props({ xray: true })} />);
    expect(boneButtons()).toHaveLength(5);
    expect(container.querySelector(".xr-ecg")).not.toBeNull();
    expect(screen.queryByText("Skeleton hidden")).toBeNull();
    expect(container.querySelector("figure.xr-film")).not.toHaveClass("xr--plain");
    expect(screen.getByRole("article", { name: "AI answer" })).not.toHaveClass("xr--plain");
  });

  it("toggles uncontrolled: starts on, switch turns it off and on", async () => {
    const user = userEvent.setup();
    const onXrayChange = vi.fn();
    render(<XrayView {...props({ onXrayChange })} />);
    expect(boneButtons()).toHaveLength(5);
    await user.click(screen.getByRole("switch"));
    expect(boneButtons()).toHaveLength(0);
    expect(onXrayChange).toHaveBeenLastCalledWith(false);
    await user.click(screen.getByRole("switch"));
    expect(boneButtons()).toHaveLength(5);
    expect(onXrayChange).toHaveBeenLastCalledWith(true);
  });

  it("toggles controlled: calls onXrayChange(!xray) and follows only the prop", async () => {
    const user = userEvent.setup();
    const onXrayChange = vi.fn();
    const { rerender } = render(<XrayView {...props({ xray: true, onXrayChange })} />);
    await user.click(screen.getByRole("switch"));
    expect(onXrayChange).toHaveBeenCalledTimes(1);
    expect(onXrayChange).toHaveBeenCalledWith(false);
    expect(boneButtons()).toHaveLength(5);
    rerender(<XrayView {...props({ xray: false, onXrayChange })} />);
    expect(boneButtons()).toHaveLength(0);
    await user.click(screen.getByRole("switch"));
    expect(onXrayChange).toHaveBeenLastCalledWith(true);
    expect(boneButtons()).toHaveLength(0);
  });

  it("hovering a bone highlights exactly its related film marks", async () => {
    const user = userEvent.setup();
    const { container } = render(<XrayView {...props({ trace: sourcedTrace() })} />);
    expect(highlightedPaths(container)).toEqual([]);
    await user.hover(boneButton("alcohol-deducting"));
    expect(highlightedPaths(container)).toEqual(["receipt.alcoholCents"]);
    await user.hover(boneButton("line-item-cap"));
    expect(highlightedPaths(container)).toEqual(["receipt.lineItems.0.amountCents"]);
    await user.unhover(boneButton("line-item-cap"));
    expect(highlightedPaths(container)).toEqual([]);
  });

  it("focusing a bone highlights exactly its related film marks", () => {
    const { container } = render(<XrayView {...props({ trace: sourcedTrace() })} />);
    act(() => boneButton("date-blocking-after").focus());
    expect(highlightedPaths(container)).toEqual(["receipt.date"]);
    act(() => boneButton("alcohol-deducting").focus());
    expect(highlightedPaths(container)).toEqual(["receipt.alcoholCents"]);
    act(() => boneButton("alcohol-deducting").blur());
    expect(highlightedPaths(container)).toEqual([]);
  });

  it("marks exactly two bones fractured and the meal-limit bone passed with 'applied, no change'", () => {
    render(<XrayView {...props()} />);
    const fractured = boneButtons().filter((b) => b.getAttribute("data-state") === "fractured");
    expect(fractured.map((b) => b.getAttribute("data-rule-id")).sort()).toEqual(["alcohol-deducting", "line-item-cap"]);
    const meal = boneButton("meal-limit");
    expect(meal).toHaveAttribute("data-state", "passed");
    expect(within(meal).getByText("applied, no change")).toBeInTheDocument();
  });

  it("knob key press calls onVersionChange and leaves the trace unchanged", async () => {
    const user = userEvent.setup();
    const trace = deepFreeze(signatureTrace());
    const before = JSON.stringify(trace);
    const onVersionChange = vi.fn();
    render(<XrayView {...props({ trace, onVersionChange })} />);
    screen.getByRole("slider", { name: "RULE VERSION" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onVersionChange).toHaveBeenCalledTimes(1);
    expect(onVersionChange).toHaveBeenCalledWith("v2");
    expect(JSON.stringify(trace)).toBe(before);
  });

  it("shows replay and override buttons only when callbacks are given and forwards clicks", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<XrayView {...props()} />);
    expect(screen.queryByRole("button", { name: "Replay decision" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Human override" })).toBeNull();
    unmount();

    const onReplay = vi.fn();
    const onOverride = vi.fn();
    render(<XrayView {...props({ onReplay, onOverride })} />);
    await user.click(screen.getByRole("button", { name: "Replay decision" }));
    await user.click(screen.getByRole("button", { name: "Human override" }));
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onOverride).toHaveBeenCalledTimes(1);
  });

  describe("effective prop and title", () => {
    const effective = { result: "approved" as const, reviewerName: "Dana" };
    const regions = [".xr-skeleton", ".xr-ecg", "article.xr-answer", "figure.xr-film", '[role="log"]'];

    function snapshot(extra: Partial<XrayViewProps>) {
      const { container, unmount } = render(<XrayView {...props({ trace: sourcedTrace(), ...extra })} />);
      const html: Record<string, string | undefined> = {};
      for (const sel of regions) html[sel] = container.querySelector(sel)?.innerHTML;
      const result = {
        fractured: container.querySelectorAll('button.xr-bone-btn[data-state="fractured"]').length,
        ecg: container.querySelector(".xr-ecg .xr-visually-hidden")?.textContent,
        overruled: container.querySelector("article.xr-answer")?.getAttribute("data-overruled"),
        html,
        plate: container.querySelector(".xr-result")?.textContent ?? "",
        outside: (() => {
          const clone = container.cloneNode(true) as HTMLElement;
          clone.querySelector(".xr-result")?.remove();
          return clone.innerHTML;
        })(),
      };
      unmount();
      return result;
    }

    it("leaves fractured count, ECG summary, overruled flag and all other regions identical", () => {
      const without = snapshot({});
      const withEff = snapshot({ effective });
      expect(without.fractured).toBe(2);
      expect(withEff.fractured).toBe(without.fractured);
      expect(without.ecg).toBeTruthy();
      expect(withEff.ecg).toBe(without.ecg);
      expect(withEff.overruled).toBe(without.overruled);
      for (const sel of regions) {
        expect(without.html[sel], sel).toBeTruthy();
        expect(withEff.html[sel], sel).toBe(without.html[sel]);
      }
      expect(withEff.outside).toBe(without.outside);
      expect(withEff.plate).not.toBe(without.plate);
    });

    it("shows 'overruled by Dana' on the plate only with effective", () => {
      const without = snapshot({});
      const withEff = snapshot({ effective });
      expect(withEff.plate).toContain("overruled by Dana");
      expect(without.plate).not.toContain("overruled by");
    });

    it("renders the title prop in h2.xr-title-plate", () => {
      const { container } = render(<XrayView {...props({ title: "Receipt 42" })} />);
      expect(container.querySelector("h2.xr-title-plate")?.textContent).toBe("Receipt 42");
    });
  });

  it("fires onMessagesComplete once with reducedMotion", () => {
    const onMessagesComplete = vi.fn();
    render(<XrayView {...props({ onMessagesComplete })} />);
    expect(onMessagesComplete).toHaveBeenCalledTimes(1);
  });
});
