import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { GlassCard } from "@bones/xray-ui";
import { buildCombinedAnatomy } from "../../src/anatomy";
import type { DerivedCase } from "../../src/derive/factDeriver";
import { displayedTrace } from "../../src/state/selectors";
import { createProductionSession } from "../../src/state/sessionStore";

describe("AI answer card victim row", () => {
  it("shows the victim name with a confidence, not '1 field'", async () => {
    const store = createProductionSession();
    if ("kind" in store) throw new Error("bundle");
    await store.loadRecordedCase("greenhouse");
    const s = store.getState();
    if (s.screen !== "case") throw new Error("no case");
    const trace = displayedTrace(s);
    const anatomy = buildCombinedAnatomy(trace.validatedFields as unknown as DerivedCase);
    const { container } = render(<GlassCard trace={trace} anatomy={anatomy} reducedMotion />);
    const row = container.querySelector('[data-path="victim"]');
    expect(row).not.toBeNull();
    const text = row!.textContent ?? "";
    expect(text).toContain("Victim");
    expect(text).toContain("Edgar Voss");
    expect(text).toMatch(/confidence \d/);
    expect(text).not.toContain("1 field");
  });
});
