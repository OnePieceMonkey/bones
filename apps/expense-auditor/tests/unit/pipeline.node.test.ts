import { describe, expect, it } from "vitest";
import { selectBones, stateText } from "@bones/xray-ui";
import type { Trace } from "@bones/core";
import { sampleTrace, testAnatomy } from "../helpers/fixtures";
import { VERSION_LABELS } from "../../src/pipeline/runPipeline";
import type { VersionLabel } from "../../src/pipeline/runPipeline";

function bonesOf(trace: Trace) {
  return selectBones(trace, testAnatomy);
}
function fractured(trace: Trace): string[] {
  return bonesOf(trace)
    .filter((b) => b.state === "fractured")
    .map((b) => b.ruleId)
    .sort();
}

describe.each(VERSION_LABELS as readonly VersionLabel[])("expected decisions at %s", (label) => {
  it("signature: partially approved at 4150 with the capped and deducted outcomes", async () => {
    const t = await sampleTrace("signature", label);
    expect(t.result).toBe("partially_approved");
    expect(t.amountCents).toBe(4150);
    expect(t.ruleOutcomes.map((o) => o.ruleId)).toEqual([
      "date-blocking-after",
      "date-blocking-before",
      "line-item-cap",
      "meal-limit",
      "alcohol-deducting",
    ]);
    const byId = Object.fromEntries(t.ruleOutcomes.map((o) => [o.ruleId, o]));
    expect(byId["date-blocking-after"]!.conditionMet).toBe(false);
    expect(byId["date-blocking-before"]!.conditionMet).toBe(false);
    expect(byId["line-item-cap"]).toMatchObject({ amountBeforeCents: 48000, amountAfterCents: 4800 });
    expect(byId["meal-limit"]).toMatchObject({ amountBeforeCents: 4800, amountAfterCents: 4800 });
    expect(byId["alcohol-deducting"]).toMatchObject({ amountBeforeCents: 4800, amountAfterCents: 4150 });
    expect(byId["line-item-cap"]!.renderedMessage).toContain("$480.00");
    expect(byId["line-item-cap"]!.renderedMessage).toContain("$48.00");
    expect(byId["alcohol-deducting"]!.renderedMessage).toContain("$6.50 deducted.");
  });

  it("signature: exactly two bones fractured and meal-limit applied with no change", async () => {
    const t = await sampleTrace("signature", label);
    expect(fractured(t)).toEqual(["alcohol-deducting", "line-item-cap"]);
    const meal = bonesOf(t).find((b) => b.ruleId === "meal-limit")!;
    expect(meal.state).toBe("passed");
    expect(stateText(meal)).toBe("applied, no change");
  });

  it("clean: approved at 3240 with no fracture", async () => {
    const t = await sampleTrace("clean", label);
    expect(t.result).toBe("approved");
    expect(t.amountCents).toBe(3240);
    expect(fractured(t)).toEqual([]);
  });

  it("outside window: rejected at 0 with only date-blocking-after fractured", async () => {
    const t = await sampleTrace("outside-window", label);
    expect(t.result).toBe("rejected");
    expect(t.amountCents).toBe(0);
    expect(t.ruleOutcomes.filter((o) => o.effect === "blocking" && o.conditionMet).map((o) => o.ruleId)).toEqual([
      "date-blocking-after",
    ]);
    expect(fractured(t)).toEqual(["date-blocking-after"]);
  });
});
