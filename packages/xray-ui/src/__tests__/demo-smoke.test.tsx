import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { XrayView } from "../components/XrayView";
import type { FilmSource } from "../types";
import { demoAnatomy } from "../../demo/anatomy";
import { VERSIONS, buildTrace } from "../../demo/demoTrace";
import type { DemoVersion } from "../../demo/demoTrace";

// Validates: Requirements 16.2, 16.4, 16.5, 16.6, 16.7, 16.9, 18.9

const source: FilmSource = { kind: "text", text: "RESTAURANT ZUM ANKER\n2024-03-15\nTotal 480.00" };

function Harness() {
  const [version, setVersion] = useState<DemoVersion>("v1");
  return (
    <XrayView
      trace={buildTrace(version)}
      anatomy={demoAnatomy}
      source={source}
      versions={[...VERSIONS]}
      version={version}
      onVersionChange={(next) => {
        const found = VERSIONS.find((v) => v === next);
        if (found !== undefined) setVersion(found);
      }}
      reducedMotion
    />
  );
}

function boneButton(ruleId: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`button.xr-bone-btn[data-rule-id="${ruleId}"]`);
  if (el === null) throw new Error(`no bone button ${ruleId}`);
  return el;
}

describe("demo smoke", () => {
  let errorSpy: MockInstance<[message?: unknown, ...optionalParams: unknown[]], void>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe.each(VERSIONS)("%s", (version) => {
    it("trace is partially approved with the expected per-rule amounts", () => {
      const trace = buildTrace(version);
      expect(trace.result).toBe("partially_approved");
      expect(trace.amountCents).toBe(4150);
      const amounts = (id: string) => {
        const o = trace.ruleOutcomes.find((r) => r.ruleId === id);
        return [o?.amountBeforeCents, o?.amountAfterCents];
      };
      expect(amounts("line-item-cap")).toEqual([48000, 4800]);
      expect(amounts("meal-limit")).toEqual([4800, 4800]);
      expect(amounts("alcohol-deducting")).toEqual([4800, 4150]);
    });

    it("renders two fractured bones and a passed Meal limit bone", () => {
      render(
        <XrayView
          trace={buildTrace(version)}
          anatomy={demoAnatomy}
          source={source}
          versions={[...VERSIONS]}
          version={version}
          onVersionChange={() => {}}
          reducedMotion
        />,
      );
      const fractured = Array.from(
        document.querySelectorAll<HTMLElement>('button.xr-bone-btn[data-state="fractured"]'),
      );
      expect(fractured.map((b) => b.dataset["ruleId"]).sort()).toEqual([
        "alcohol-deducting",
        "line-item-cap",
      ]);
      const meal = boneButton("meal-limit");
      expect(meal).toHaveAttribute("data-state", "passed");
      expect(meal).toHaveTextContent("applied, no change");
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  it("a knob key press changes the shown rule version from 1.0.0 to 2.0.0", () => {
    render(<Harness />);
    expect(boneButton("meal-limit")).toHaveAccessibleName(/meal-limit version 1\.0\.0/);
    fireEvent.keyDown(screen.getByRole("slider", { name: "RULE VERSION" }), { key: "ArrowRight" });
    expect(boneButton("meal-limit")).toHaveAccessibleName(/meal-limit version 2\.0\.0/);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
