import { describe, expect, it } from "vitest";
import { anatomy } from "../../src/anatomy";
import { formatValue } from "../../src/format/formatValue";
import { SAMPLE_IDS } from "../../src/extraction/samples";
import { loadSample, readRuleDir } from "../helpers/fixtures";

describe("anatomy", () => {
  it("maps each rule id to its region and label", () => {
    const by = Object.fromEntries(anatomy.bones.map((b) => [b.ruleId, b]));
    expect(by["meal-limit"]).toMatchObject({ region: "ribs", label: "Meal limit" });
    expect(by["date-blocking-before"]).toMatchObject({ region: "spine", label: "Date before trip" });
    expect(by["date-blocking-after"]).toMatchObject({ region: "spine", label: "Date after trip" });
    expect(by["alcohol-deducting"]).toMatchObject({ region: "pelvis", label: "Alcohol" });
    expect(by["line-item-cap"]).toMatchObject({ region: "arm-right", label: "Line-item match" });
    expect(anatomy.bones).toHaveLength(5);
  });

  it("has a label for every Rule_Field, amountCents and both computed keys", () => {
    const keys = [
      "merchant",
      "receiptDate",
      "claimedTotalCents",
      "lineItems",
      "lineItemSumCents",
      "alcoholLineCents",
      "alcoholLineItems",
      "tripStart",
      "tripEnd",
      "amountCents",
      "lineItems[*].amount_sum",
      "alcoholLineItems[*].amount_sum",
    ];
    for (const k of keys) expect(anatomy.fieldLabels[k], k).toBeTruthy();
    expect(anatomy.fieldLabels["alcoholLineItems[*].amount_sum"]).toBe("Alcohol total");
  });

  it("has a bone for every rule id used by the three rule sets", () => {
    const ids = new Set(anatomy.bones.map((b) => b.ruleId));
    const sets = Object.entries(readRuleDir("rule-sets"));
    expect(sets).toHaveLength(3);
    for (const [name, set] of sets) {
      const rules = (set as { rules: { ruleId: string }[] }).rules;
      expect(rules.length, name).toBeGreaterThan(0);
      for (const r of rules) expect(ids.has(r.ruleId), `${name}:${r.ruleId}`).toBe(true);
    }
  });

  it("uses the app formatValue, with dollars and never EUR", () => {
    expect(anatomy.formatValue).toBe(formatValue);
    expect(anatomy.formatValue?.("claimedTotalCents", 4800)).toBe("$48.00");
    expect(anatomy.formatValue?.("amountCents", 4800)).not.toContain("EUR");
  });

  it("labels every proposed field key of the three recorded samples", () => {
    expect(SAMPLE_IDS).toHaveLength(3);
    for (const id of SAMPLE_IDS) {
      const keys = Object.keys(loadSample(id).extraction.proposedFields);
      for (const k of ["merchant", "receiptDate", "claimedTotalCents", "lineItems"]) {
        expect(keys, id).toContain(k);
      }
      for (const k of keys) expect(anatomy.fieldLabels[k], `${id}:${k}`).toBeTruthy();
    }
  });

  it("has no camelCase label", () => {
    const labels = [...Object.values(anatomy.fieldLabels), ...anatomy.bones.map((b) => b.label)];
    for (const label of labels) expect(label).not.toMatch(/[a-z][A-Z]/);
  });
});
