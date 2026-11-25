import { isCoreError } from "@bones/core";
import { describe, expect, it } from "vitest";
import { deriveFacts } from "../../src/derive/factDeriver";
import { extractCaseFields, modelOutputSchema } from "../../src/pipeline/schema";
import type { RuleBundle } from "../../src/rules/catalog";
import { NO_CONTRADICTED_STATEMENT, solve } from "../../src/solver/solve";
import { loadTestBundle, readRecorded } from "../helpers/fixtures";

const loaded = loadTestBundle();
if (isCoreError(loaded)) throw new Error(JSON.stringify(loaded));
const bundle: RuleBundle = loaded;

function derived(id: string) {
  const entry = readRecorded().find((r) => r.json.id === id)!;
  return deriveFacts(extractCaseFields(modelOutputSchema.parse(entry.json.extraction.proposedFields)));
}

describe("solve", () => {
  it("lists unfired proof instances and the closest suspect for empty-room v1", () => {
    const r = solve(derived("empty-room"), "v1", bundle);
    if (isCoreError(r)) throw new Error("error");
    expect(r.verdict).toBe("unfair_none");
    for (const s of r.suspects) {
      expect(s.convictable).toBe(false);
      expect(s.missing.length).toBeGreaterThan(0);
    }
    const reason = r.reasons[0]!;
    expect(reason.code).toBe("none");
    if (reason.code !== "none") return;
    const min = Math.min(...r.suspects.map((s) => s.missing.length));
    const firstWithMin = r.suspects.find((s) => s.missing.length === min)!;
    expect(reason.closestSuspectId).toBe(firstWithMin.suspectId);
    expect(reason.missing).toEqual(firstWithMin.missing);
  });

  it("marks a suspect without a contradicted statement", () => {
    const r = solve(derived("greenhouse"), "v1", bundle);
    if (isCoreError(r)) throw new Error("error");
    const gardener = r.suspects.find((s) => s.suspectId === "gardener")!;
    expect(gardener.missing).toContain(NO_CONTRADICTED_STATEMENT);
    expect(gardener.missing).toContain("proof-opportunity:gardener");
    expect(r.reasons).toEqual([{ code: "one", suspectId: "widow" }]);
    expect(r.ruleSetVersion).toBe("1.0.0");
  });

  it("reports many convictable suspects in case order", () => {
    const r = solve(derived("candlesticks"), "v1", bundle);
    if (isCoreError(r)) throw new Error("error");
    expect(r.reasons).toEqual([{ code: "many", suspectIds: ["ada", "bram"] }]);
  });

  it("returns a binder CoreError unchanged", () => {
    const broken: RuleBundle = { ...bundle, templateCatalog: new Map() };
    const r = solve(derived("greenhouse"), "v1", broken);
    expect(isCoreError(r)).toBe(true);
    if (isCoreError(r)) expect(r.kind).toBe("rule_not_found");
  });
});
