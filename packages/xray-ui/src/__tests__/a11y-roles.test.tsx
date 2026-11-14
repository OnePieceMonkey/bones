import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { XrayView } from "../components/XrayView";
import type { FilmSource } from "../types";
import { signatureAnatomy, signatureTrace } from "./helpers/fixtures";

// Validates: Requirements 2.9, 2.10, 2.11, 3.4, 6.8, 7.6, 7.12, 12.1, 12.3

const source: FilmSource = { kind: "text", text: "Trattoria Roma\n2024-05-14\nWine 6.50\nTotal 480.00" };

function renderView() {
  return render(
    <XrayView
      trace={signatureTrace()}
      anatomy={signatureAnatomy()}
      source={source}
      versions={["v1", "v2", "v3"]}
      version="v1"
      onVersionChange={() => {}}
      reducedMotion={true}
    />,
  );
}

const boneButtons = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>("button.xr-bone-btn")];

describe("accessibility roles", () => {
  it("exposes slider, meter, switch, log and status roles", () => {
    renderView();
    expect(screen.getByRole("slider", { name: "RULE VERSION" })).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "AI READ CONFIDENCE" })).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("log")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("switch aria-checked follows the X-RAY toggle", async () => {
    renderView();
    const sw = screen.getByRole("switch");
    await userEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("hides the ECG svg from assistive technology", () => {
    const { container } = renderView();
    const svg = container.querySelector(".xr-ecg svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("shows a tooltip on hover", async () => {
    renderView();
    expect(screen.queryByRole("tooltip")).toBeNull();
    await userEvent.hover(boneButtons()[0] as HTMLElement);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("gives every bone button an accessible name and visible state text", () => {
    renderView();
    const buttons = boneButtons();
    expect(buttons).toHaveLength(signatureAnatomy().bones.length);
    for (const b of buttons) {
      expect(b.getAttribute("aria-label")?.trim()).toBeTruthy();
      const state = b.querySelector(".xr-bone-state");
      expect(state?.textContent?.trim()).toBeTruthy();
      expect(b.getAttribute("aria-label")).toContain(state?.textContent ?? "\u0000");
    }
  });

  it("visits bones in Anatomy order with Tab", async () => {
    renderView();
    const expected = signatureAnatomy().bones.map((b) => b.ruleId);
    const visited: string[] = [];
    const user = userEvent.setup();
    for (let i = 0; i < 80 && visited.length < expected.length; i++) {
      await user.tab();
      const el = document.activeElement as HTMLElement | null;
      if (el?.classList.contains("xr-bone-btn")) visited.push(el.getAttribute("data-rule-id") ?? "");
    }
    expect(visited).toEqual(expected);
  });
});
