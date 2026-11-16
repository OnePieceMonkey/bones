import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Shell } from "../../components/shell/Shell";
import type { FilmSource } from "../../types";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";
import { installNetSpy, type NetSpy } from "../helpers/netSpy";

const source: FilmSource = { kind: "text", text: "Trattoria Roma\n2024-05-14\nWine 6.50\nTotal 480.00" };

function ui(xray = true, reducedMotion = false) {
  return (
    <Shell
      trace={signatureTrace()}
      anatomy={signatureAnatomy()}
      source={source}
      heading="Audit"
      lightboxLabel="Audit - RECORDED"
      versions={["v1", "v2", "v3"]}
      version="v1"
      onVersionChange={() => {}}
      xray={xray}
      onXrayChange={() => {}}
      introKey="case-1"
      claimedCents={48_000}
      reducedMotion={reducedMotion}
      onReplay={() => {}}
      onOverride={() => {}}
      statusNote={<span>status line</span>}
      headerActions={<button type="button">Download trace</button>}
    />
  );
}

afterEach(cleanup);

describe("Shell", () => {
  it("composes document, answer, stage, doctor and controls, with the label as hidden text", () => {
    const { container } = render(ui());
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByText("Audit - RECORDED").className).toContain("xr-visually-hidden");
    expect(screen.getByRole("article", { name: "AI answer" })).toBeTruthy();
    expect(container.querySelector(".xr-hotspots")).toBeTruthy();
    expect(screen.getByRole("log")).toBeTruthy();
    expect(screen.getByRole("slider", { name: "RULE VERSION" })).toBeTruthy();
    expect(screen.getByText("status line").closest("[aria-live]")?.getAttribute("aria-live")).toBe("polite");
  });

  it("renders the status note in the header and nothing after the steel frame", () => {
    const { container } = render(ui());
    const note = screen.getByText("status line");
    expect(container.querySelector("header.xr-header")?.contains(note)).toBe(true);
    const shell = container.querySelector(".xr-shell");
    expect(shell?.lastElementChild?.classList.contains("xr-shell-frame")).toBe(true);
  });

  it("does not mount the stage in the flat view but keeps the content", () => {
    const { container } = render(ui(false));
    expect(container.querySelector(".xr-hotspots")).toBeNull();
    expect(container.querySelector("button.xr-bone-btn")).toBeNull();
    expect(screen.getByRole("article", { name: "AI answer" })).toBeTruthy();
  });

  it("keeps tab order: header actions, document, hotspots, doctor buttons, control panel", () => {
    const { container } = render(ui(true, true));
    const order = (el: Element | null): number => {
      const all = Array.from(container.querySelectorAll("*"));
      return el ? all.indexOf(el) : -1;
    };
    const action = screen.getByRole("button", { name: "Download trace" });
    const doc = container.querySelector(".xr-doc-scroll");
    const hotspot = container.querySelector("button.xr-bone-btn");
    const replay = screen.getByRole("button", { name: "Replay decision" });
    const knob = screen.getByRole("slider", { name: "RULE VERSION" });
    const seq = [action, doc, hotspot, replay, knob].map(order);
    expect(seq.every((n) => n >= 0)).toBe(true);
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
  });
});

describe("Shell without network or audio", () => {
  let spy: NetSpy;
  let audioCalls = 0;
  const g = globalThis as unknown as Record<string, unknown>;
  const savedAudio = { Audio: g["Audio"], AudioContext: g["AudioContext"] };

  beforeEach(() => {
    vi.useFakeTimers();
    spy = installNetSpy();
    audioCalls = 0;
    g["Audio"] = function AudioStub(): never {
      audioCalls += 1;
      throw new Error("audio is forbidden");
    };
    g["AudioContext"] = function AudioContextStub(): never {
      audioCalls += 1;
      throw new Error("audio is forbidden");
    };
  });

  afterEach(() => {
    spy.restore();
    for (const [k, v] of Object.entries(savedAudio)) {
      if (v === undefined) delete g[k];
      else g[k] = v;
    }
    vi.useRealTimers();
  });

  it("renders and finishes its chat with zero network and audio calls", () => {
    render(ui());
    for (let t = 0; t < 60_000; t += 8) {
      act(() => {
        vi.advanceTimersByTime(8);
      });
    }
    expect(spy.calls).toEqual([]);
    expect(audioCalls).toBe(0);
  });
});
