import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, renderHook } from "@testing-library/react";
import { Stage } from "../../components/stage/Stage";
import { HoveredRuleProvider } from "../../hooks/useHoveredRule";
import { useFractureBatches } from "../../hooks/useFractureBatches";
import type { BoneView } from "../../types";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

afterEach(cleanup);

const bone = (ruleId: string, index: number, fractured: boolean): BoneView =>
  ({ ruleId, index, state: fractured ? "fractured" : "passed" }) as unknown as BoneView;

describe("useFractureBatches", () => {
  it("starts with no keys and no shake class", () => {
    const { result } = renderHook(() => useFractureBatches([bone("a", 0, true)]));
    expect(result.current.fxKeys.size).toBe(0);
    expect(result.current.shakeClass).toBe("");
  });

  it("bumps only newly fractured bones and alternates the shake class per batch", () => {
    const { result, rerender } = renderHook(({ bones }) => useFractureBatches(bones), {
      initialProps: { bones: [bone("a", 0, true), bone("b", 1, false), bone("c", 2, false)] },
    });
    rerender({ bones: [bone("a", 0, true), bone("b", 1, true), bone("c", 2, false)] });
    expect(result.current.fxKeys.get("b:1")).toBe(1);
    expect(result.current.fxKeys.get("a:0") ?? 0).toBe(0);
    expect(result.current.shakeClass).toBe("xr-shake-a");

    // Same state again: no new batch.
    rerender({ bones: [bone("a", 0, true), bone("b", 1, true), bone("c", 2, false)] });
    expect(result.current.shakeClass).toBe("xr-shake-a");

    // Two bones become fractured together: one batch, one class flip.
    rerender({ bones: [bone("a", 0, false), bone("b", 1, false), bone("c", 2, false)] });
    rerender({ bones: [bone("a", 0, true), bone("b", 1, true), bone("c", 2, true)] });
    expect(result.current.fxKeys.get("a:0")).toBe(1);
    expect(result.current.fxKeys.get("b:1")).toBe(2);
    expect(result.current.fxKeys.get("c:2")).toBe(1);
    expect(result.current.shakeClass).toBe("xr-shake-b");
  });

  it("keeps the shake class when bones only stop being fractured", () => {
    const { result, rerender } = renderHook(({ bones }) => useFractureBatches(bones), {
      initialProps: { bones: [bone("a", 0, false)] },
    });
    rerender({ bones: [bone("a", 0, true)] });
    expect(result.current.shakeClass).toBe("xr-shake-a");
    rerender({ bones: [bone("a", 0, false)] });
    expect(result.current.shakeClass).toBe("xr-shake-a");
  });
});

describe("Stage fracture group remount", () => {
  const renderStage = (fxKeys: Map<string, number>) => (
    <HoveredRuleProvider>
      <Stage trace={signatureTrace()} anatomy={signatureAnatomy()} fxKeys={fxKeys} />
    </HoveredRuleProvider>
  );

  it("remounts the group of a bone whose key changed and keeps the others", () => {
    const { container, rerender } = render(renderStage(new Map()));
    const fx = [...container.querySelectorAll(".xr-fx")];
    expect(fx.length).toBeGreaterThan(1);
    expect(fx.every((el) => el.getAttribute("data-fresh") === "false")).toBe(true);
    const ruleId = fx[0]!.closest(".xr-hotspot")!.getAttribute("data-rule-id")!;
    const bones = [...container.querySelectorAll(".xr-hotspot")];
    const idx = bones.findIndex((el) => el.getAttribute("data-rule-id") === ruleId);
    rerender(renderStage(new Map([[`${ruleId}:${idx}`, 1]])));
    const after = [...container.querySelectorAll(".xr-fx")];
    expect(after[0]).not.toBe(fx[0]);
    expect(after[0]!.getAttribute("data-fresh")).toBe("true");
    for (let i = 1; i < fx.length; i++) expect(after[i]).toBe(fx[i]);
  });
});
