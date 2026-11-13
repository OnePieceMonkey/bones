import { describe, expect, it } from "vitest";
import { buildChatMessages } from "../../model/chat";
import type { Anatomy } from "../../types";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

const money = (path: string, value: unknown): string =>
  path === "amountCents" && typeof value === "number"
    ? `$${(value / 100).toFixed(2)}`
    : String(value);

describe("buildChatMessages", () => {
  it("emits greeting, one message per fracture, summary, result in order", () => {
    const msgs = buildChatMessages(signatureTrace(), signatureAnatomy());
    expect(msgs.map((m) => m.kind)).toEqual([
      "greeting",
      "fracture",
      "fracture",
      "summary",
      "result",
    ]);
    expect(msgs.map((m) => m.id)).toEqual([
      "greeting",
      "fracture-0",
      "fracture-1",
      "summary",
      "result",
    ]);
  });

  it("uses singular summary for one healthy bone", () => {
    const full = signatureTrace();
    // cap (fracture) + meal (no change)
    const trace = { ...full, ruleOutcomes: full.ruleOutcomes.slice(2, 4) };
    const anatomy: Anatomy = {
      ...signatureAnatomy(),
      bones: signatureAnatomy().bones.slice(2, 4),
    };
    const msgs = buildChatMessages(trace, anatomy);
    expect(msgs.find((m) => m.kind === "summary")?.text).toBe("1 other bone looks healthy.");
  });

  it("uses plural summary for several healthy bones", () => {
    const msgs = buildChatMessages(signatureTrace(), signatureAnatomy());
    expect(msgs.find((m) => m.kind === "summary")?.text).toBe("3 other bones look healthy.");
  });

  it("limits evidence lines to two per fracture", () => {
    const full = signatureTrace();
    const trace = {
      ...full,
      ruleOutcomes: full.ruleOutcomes.map((o) =>
        o.ruleId === "line-item-cap" ? { ...o, evidence: { a: 1, b: 2, c: 3, d: 4 } } : o,
      ),
    };
    const msgs = buildChatMessages(trace, signatureAnatomy());
    const lines = msgs[1]!.text.split("\n");
    expect(lines).toHaveLength(2 + 2);
    expect(lines.slice(2)).toEqual(["a: 1", "b: 2"]);
  });

  it("gives no message for a fractured outcome without an anatomy bone", () => {
    const anatomy: Anatomy = {
      ...signatureAnatomy(),
      bones: signatureAnatomy().bones.filter((b) => b.ruleId !== "alcohol-deducting"),
    };
    const msgs = buildChatMessages(signatureTrace(), anatomy);
    expect(msgs.filter((m) => m.kind === "fracture")).toHaveLength(1);
    expect(msgs.some((m) => m.text.includes("alcohol-deducting"))).toBe(false);
  });

  it("treats applied-no-change as healthy: no fracture message, counted in summary", () => {
    const msgs = buildChatMessages(signatureTrace(), signatureAnatomy());
    expect(msgs.some((m) => m.text.includes("meal-limit"))).toBe(false);
    expect(msgs.some((m) => m.text.includes("Meal limit"))).toBe(false);
    // 2 date bones + meal-limit
    expect(msgs.find((m) => m.kind === "summary")?.text).toBe("3 other bones look healthy.");
  });

  it("formats the result amount with formatValue('amountCents', ...)", () => {
    const anatomy: Anatomy = { ...signatureAnatomy(), formatValue: money };
    const msgs = buildChatMessages(signatureTrace(), anatomy);
    expect(msgs[msgs.length - 1]!.text).toBe("Result: PARTIALLY APPROVED. Amount: $41.50.");
  });

  it("matches the signature trace transcript", () => {
    const msgs = buildChatMessages(signatureTrace(), signatureAnatomy());
    expect(msgs.map((m) => m.text).join("\n---\n")).toMatchInlineSnapshot(`
      "Let's take a look at this decision.
      ---
      I see a fracture in the Line item cap bone.
      Rule line-item-cap v1.0.0: A line item may not exceed 4800 cents.
      receipt.lineItems.0.amountCents: 48000
      ---
      I see a fracture in the Alcohol deduction bone.
      Rule alcohol-deducting v1.0.0: Alcohol of 650 cents is not reimbursable.
      receipt.alcoholCents: 650
      ---
      3 other bones look healthy.
      ---
      Result: PARTIALLY APPROVED. Amount: 4150."
    `);
  });
});
