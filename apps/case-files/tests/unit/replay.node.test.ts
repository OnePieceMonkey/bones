import { isCoreError } from "@bones/core";
import type { ExtractionPort, ExtractionResult, KernelPorts, Trace } from "@bones/core";
import { describe, expect, it, vi } from "vitest";
import { makePortFactory } from "../../src/pipeline/ports";
import { replayCase, verdictOf } from "../../src/pipeline/replayCase";
import { runCasePipeline } from "../../src/pipeline/runCasePipeline";
import { RULE_SET_REFS, VERSION_LABELS } from "../../src/rules/catalog";
import type { RuleBundle } from "../../src/rules/catalog";
import type { VersionLabel } from "../../src/rules/catalog";
import { EXPECTED_MATRIX } from "../fixtures/expected-matrix";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle, readRecorded } from "../helpers/fixtures";

const loaded = loadTestBundle();
if (isCoreError(loaded)) throw new Error(JSON.stringify(loaded));
const bundle: RuleBundle = loaded;
const recorded = new Map(readRecorded().map((r) => [r.json.id, r.json]));

async function original(caseId: string, label: VersionLabel = "v1"): Promise<Trace> {
  const ex = structuredClone(recorded.get(caseId)!.extraction) as ExtractionResult;
  const adapter: ExtractionPort = { extract: async () => structuredClone(ex) };
  const t = await runCasePipeline({
    input: { raw: "case" },
    adapter,
    versionLabel: label,
    bundle,
    portFactory: makePortFactory(counterPorts()),
  });
  if (isCoreError(t)) throw new Error(JSON.stringify(t));
  return t;
}

describe("replayCase", () => {
  it("leaves the original Trace unchanged", async () => {
    const o = await original("greenhouse");
    const before = structuredClone(o);
    const r = replayCase({ original: o, label: "v2", bundle, ports: makePortFactory(counterPorts()).base });
    expect(isCoreError(r)).toBe(false);
    expect(o).toEqual(before);
  });

  it("carries the rule set version of the label and the original inputHash", async () => {
    const o = await original("greenhouse");
    for (const label of VERSION_LABELS) {
      const ports = makePortFactory({ ...counterPorts(), uuid: () => "replay-id" }).base;
      const r = replayCase({ original: o, label, bundle, ports });
      if (isCoreError(r)) throw new Error(JSON.stringify(r));
      expect(r.ruleSetVersion).toBe(RULE_SET_REFS[label].version);
      expect(r.inputHash).toBe(o.inputHash);
      expect(r.rawModelOutput).toBe(o.rawModelOutput);
      expect(r.decisionId).not.toBe(o.decisionId);
    }
  });

  it("calls no hasher (replayCase takes no adapter)", async () => {
    const o = await original("candlesticks");
    const base = makePortFactory(counterPorts()).base;
    const hasher = vi.fn(base.hasher);
    const ports: KernelPorts = { ...base, hasher };
    const r = replayCase({ original: o, label: "v3", bundle, ports });
    expect(isCoreError(r)).toBe(false);
    expect(hasher).toHaveBeenCalledTimes(0);
  });

  it("returns a binder CoreError", async () => {
    const o = await original("greenhouse");
    const noRules = { ...bundle, templateCatalog: new Map() } as RuleBundle;
    const r = replayCase({ original: o, label: "v1", bundle: noRules, ports: makePortFactory(counterPorts()).base });
    expect(isCoreError(r) && r.kind).toBe("rule_not_found");
  });
});

describe("verdictOf", () => {
  it("agrees with Trace.result for the nine combinations", async () => {
    for (const cell of EXPECTED_MATRIX) {
      const t = await original(cell.caseId, cell.label);
      const v = verdictOf(t, bundle);
      if (isCoreError(v)) throw new Error(JSON.stringify(v));
      expect(v.verdict, `${cell.caseId} ${cell.label}`).toBe(cell.verdict);
      expect(v.verdict === "accepted" ? "approved" : "rejected").toBe(t.result);
      expect(v.convictable.length).toBe(t.amountCents);
      expect(v.convictable).toEqual([...cell.convictable]);
    }
  });

  it("returns rule_not_found for an unknown rule set version", async () => {
    const o = await original("greenhouse");
    const e = verdictOf({ ...o, ruleSetVersion: "9.9.9" } as Trace, bundle);
    expect(isCoreError(e) && e.kind).toBe("rule_not_found");
  });
});
