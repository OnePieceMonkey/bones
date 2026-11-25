import { isCoreError } from "@bones/core";
import type { ExtractionPort, ExtractionResult, Trace } from "@bones/core";
import { describe, expect, it, vi } from "vitest";
import { makePortFactory } from "../../src/pipeline/ports";
import { verdictOf } from "../../src/pipeline/replayCase";
import { runCasePipeline } from "../../src/pipeline/runCasePipeline";
import type { RuleBundle, VersionLabel } from "../../src/rules/catalog";
import { computeAccusation } from "../../src/state/accusation";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle, readRecorded } from "../helpers/fixtures";

const loaded = loadTestBundle();
if (isCoreError(loaded)) throw new Error(JSON.stringify(loaded));
const bundle: RuleBundle = loaded;
const recorded = new Map(readRecorded().map((r) => [r.json.id, r.json]));

async function traceOf(caseId: string, label: VersionLabel): Promise<Trace> {
  const ex = structuredClone(recorded.get(caseId)!.extraction) as ExtractionResult;
  const adapter: ExtractionPort = { extract: async () => structuredClone(ex) };
  const t = await runCasePipeline({
    input: { raw: "case" },
    adapter,
    versionLabel: label,
    bundle: bundle,
    portFactory: makePortFactory(counterPorts()),
  });
  if (isCoreError(t)) throw new Error(JSON.stringify(t));
  return t;
}

describe("computeAccusation", () => {
  it("lists exactly the fired instances of the widow of greenhouse under v1 (no motive rule in v1)", async () => {
    const t = await traceOf("greenhouse", "v1");
    const v = verdictOf(t, bundle);
    if (isCoreError(v)) throw new Error(JSON.stringify(v));
    const r = computeAccusation(t, "widow", v.convictable, () => new Date(0));
    expect(r.verdict).toBe("correct");
    expect([...r.proofRuleIds].sort()).toEqual(
      [
        "proof-means:widow",
        "proof-opportunity:widow",
        "statement-location-contradicted:st-widow-1",
      ].sort(),
    );
    expect(r.decisionId).toBe(t.decisionId);
    expect(r.ruleSetVersion).toBe(t.ruleSetVersion);
  });

  it("marks a non-convictable suspect incorrect and lists only that suspect's rules", async () => {
    const t = await traceOf("greenhouse", "v1");
    const r = computeAccusation(t, "gardener", ["widow"], () => new Date(0));
    expect(r.verdict).toBe("incorrect");
    const own = new Set(["proof-means:gardener", "proof-motive:gardener", "proof-opportunity:gardener", "statement-location-contradicted:st-gardener-1"]);
    expect(r.proofRuleIds.every((id) => own.has(id))).toBe(true);
  });

  it("takes createdAt from the clock port", async () => {
    const t = await traceOf("greenhouse", "v1");
    const clock = vi.fn(() => new Date("2026-01-02T03:04:05.000Z"));
    const r = computeAccusation(t, "widow", ["widow"], clock);
    expect(clock).toHaveBeenCalledTimes(1);
    expect(r.createdAt).toBe("2026-01-02T03:04:05.000Z");
  });
});
