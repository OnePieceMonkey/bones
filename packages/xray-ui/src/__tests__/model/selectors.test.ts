import { describe, expect, it } from "vitest";
import type { RuleOutcome } from "@bones/core";
import {
  evidenceRows,
  fieldLabel,
  fieldViews,
  isAppliedNoChange,
  isFracture,
  overruledFields,
  selectBones,
  sourceMarks,
  stateText,
} from "../../model/selectors";
import type { Anatomy, Trace } from "../../types";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

function outcome(over: Partial<RuleOutcome> & { ruleId: string }): RuleOutcome {
  return {
    ruleVersion: "1.0.0",
    effect: "blocking",
    conditionMet: true,
    evidence: {},
    renderedMessage: "msg",
    ...over,
  } as RuleOutcome;
}

function oneBone(o: RuleOutcome | undefined) {
  const trace: Trace = { ...signatureTrace(), ruleOutcomes: o ? [o] : [] };
  const anatomy: Anatomy = {
    bones: [{ ruleId: "r", label: "R", region: "skull" }],
    fieldLabels: {},
  };
  return selectBones(trace, anatomy)[0]!;
}

describe("isFracture / isAppliedNoChange", () => {
  it("blocking with conditionMet is fractured without amount fields", () => {
    expect(isFracture(outcome({ ruleId: "r", effect: "blocking" }))).toBe(true);
  });

  it("blocking with conditionMet false is not fractured", () => {
    expect(isFracture(outcome({ ruleId: "r", conditionMet: false }))).toBe(false);
  });

  for (const effect of ["capping", "deducting"] as const) {
    it(`${effect} with equal amounts is applied, no change`, () => {
      const o = outcome({ ruleId: "r", effect, amountBeforeCents: 100, amountAfterCents: 100 });
      expect(isFracture(o)).toBe(false);
      expect(isAppliedNoChange(o)).toBe(true);
      expect(oneBone(o).state).toBe("passed");
      expect(stateText(oneBone(o))).toBe("applied, no change");
    });

    it(`${effect} with a lower amountAfterCents is fractured`, () => {
      const o = outcome({ ruleId: "r", effect, amountBeforeCents: 100, amountAfterCents: 40 });
      expect(isFracture(o)).toBe(true);
      expect(isAppliedNoChange(o)).toBe(false);
      expect(stateText(oneBone(o))).toBe("fractured");
    });

    it(`${effect} without amount fields is not fractured`, () => {
      expect(isFracture(outcome({ ruleId: "r", effect }))).toBe(false);
    });

    it(`${effect} with conditionMet false is passed even with a lower amountAfterCents`, () => {
      const o = outcome({
        ruleId: "r",
        effect,
        conditionMet: false,
        amountBeforeCents: 100,
        amountAfterCents: 40,
      });
      expect(isFracture(o)).toBe(false);
      expect(isAppliedNoChange(o)).toBe(false);
      const bone = oneBone(o);
      expect(bone.state).toBe("passed");
      expect(stateText(bone)).toBe("passed");
    });
  }

  it("conditionMet true with an unknown effect is not a fracture", () => {
    const o = outcome({ ruleId: "r", effect: "weird" as never });
    expect(isFracture(o)).toBe(false);
    expect(isAppliedNoChange(o)).toBe(false);
  });
});

describe("selectBones", () => {
  it("gives passed, not-applicable and fractured states", () => {
    const base = signatureTrace();
    const trace: Trace = {
      ...base,
      ruleOutcomes: base.ruleOutcomes.filter((o) => o.ruleId !== "meal-limit"),
    };
    const bones = selectBones(trace, signatureAnatomy());
    const byId = Object.fromEntries(bones.map((b) => [b.ruleId, b]));
    expect(byId["date-blocking-after"]!.state).toBe("passed");
    expect(byId["line-item-cap"]!.state).toBe("fractured");
    expect(byId["line-item-cap"]!.splinters.length).toBeGreaterThan(0);
    expect(byId["meal-limit"]!.state).toBe("not-applicable");
    expect(byId["meal-limit"]!.version).toBeNull();
    expect(stateText(byId["meal-limit"]!)).toBe("not applicable");
    expect(byId["alcohol-deducting"]!.state).toBe("fractured");
  });

  it("ignores outcomes without a bone", () => {
    const base = signatureTrace();
    const trace: Trace = {
      ...base,
      ruleOutcomes: [...base.ruleOutcomes, outcome({ ruleId: "unmapped" })],
    };
    const bones = selectBones(trace, signatureAnatomy());
    expect(bones).toHaveLength(5);
    expect(bones.some((b) => b.ruleId === "unmapped")).toBe(false);
  });

  it("uses the first outcome when ids are duplicated", () => {
    const trace: Trace = {
      ...signatureTrace(),
      ruleOutcomes: [
        outcome({ ruleId: "r", conditionMet: false, ruleVersion: "1.0.0" }),
        outcome({ ruleId: "r", conditionMet: true, ruleVersion: "2.0.0" }),
      ],
    };
    const bone = selectBones(trace, {
      bones: [{ ruleId: "r", label: "R", region: "skull" }],
      fieldLabels: {},
    })[0]!;
    expect(bone.state).toBe("passed");
    expect(bone.version).toBe("1.0.0");
  });
});

describe("evidenceRows / fieldLabel", () => {
  it("keeps key order and falls back to the path as label", () => {
    const o = outcome({ ruleId: "r", evidence: { "b.x": 1, "a.y": "two", "receipt.date": "d" } });
    const rows = evidenceRows(o, signatureAnatomy());
    expect(rows.map((r) => r.path)).toEqual(["b.x", "a.y", "receipt.date"]);
    expect(rows.map((r) => r.label)).toEqual(["b.x", "a.y", "Date"]);
  });

  it("ignores prototype keys", () => {
    const anatomy = signatureAnatomy();
    expect(fieldLabel(anatomy, "constructor")).toBe("constructor");
    expect(fieldLabel(anatomy, "toString")).toBe("toString");
    expect(fieldLabel(anatomy, "__proto__")).toBe("__proto__");
    expect(fieldLabel(anatomy, "receipt.date")).toBe("Date");
  });
});

describe("overruledFields", () => {
  it("ignores computed keys and applied-no-change outcomes", () => {
    const trace = signatureTrace();
    const bones = selectBones(trace, signatureAnatomy());
    const map = overruledFields(trace, bones);
    // Evidence keys of the fractured bones are computed (not proposed), meal-limit is no-change.
    expect(map.size).toBe(0);

    const trace2: Trace = {
      ...trace,
      ruleOutcomes: [
        ...trace.ruleOutcomes.filter((o) => o.ruleId !== "line-item-cap"),
        outcome({
          ruleId: "line-item-cap",
          effect: "capping",
          amountBeforeCents: 10,
          amountAfterCents: 5,
          evidence: { "receipt.totalCents": 48000, "computed.x": 1 },
        }),
        outcome({
          ruleId: "meal-limit",
          effect: "capping",
          amountBeforeCents: 5,
          amountAfterCents: 5,
          evidence: { "receipt.date": "x" },
        }),
      ],
    };
    const map2 = overruledFields(trace2, selectBones(trace2, signatureAnatomy()));
    expect([...map2.keys()]).toEqual(["receipt.totalCents"]);
    expect(map2.get("receipt.totalCents")!.map((b) => b.ruleId)).toEqual(["line-item-cap"]);
  });
});

describe("sourceMarks", () => {
  it("skips undefined sources and highlights related fields", () => {
    const trace: Trace = {
      ...signatureTrace(),
      sources: {
        "receipt.merchant": undefined,
        "receipt.date": { kind: "line", lineIndex: 1 },
        "receipt.totalCents": { kind: "line", lineIndex: 2 },
      } as Trace["sources"],
      ruleOutcomes: [
        outcome({ ruleId: "r", evidence: { "receipt.date": "2024-05-14" } }),
      ],
    };
    const anatomy: Anatomy = {
      bones: [{ ruleId: "r", label: "R", region: "skull" }],
      fieldLabels: { "receipt.date": "Date" },
    };
    const bones = selectBones(trace, anatomy);
    const marks = sourceMarks(trace, anatomy, bones[0]);
    expect(marks.map((m) => m.path)).toEqual(["receipt.date", "receipt.totalCents"]);
    expect(marks.map((m) => m.tag)).toEqual(["1", "2"]);
    expect(marks.map((m) => m.highlighted)).toEqual([true, false]);
    expect(sourceMarks(trace, anatomy, undefined).every((m) => !m.highlighted)).toBe(true);
  });
});

describe("fieldViews", () => {
  it('gives "n/a" without confidence', () => {
    const trace = signatureTrace();
    delete (trace.confidence as Record<string, number>)["receipt.date"];
    const bones = selectBones(trace, signatureAnatomy());
    const views = fieldViews(trace, signatureAnatomy(), bones);
    const byPath = Object.fromEntries(views.map((v) => [v.path, v]));
    expect(byPath["receipt.date"]!.confidenceText).toBe("n/a");
    expect(byPath["receipt.merchant"]!.confidenceText).toBe("0.97");
    expect(byPath["receipt.merchant"]!.overruled).toBe(false);
  });
});
