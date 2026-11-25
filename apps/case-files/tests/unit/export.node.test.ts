import { isCoreError } from "@bones/core";
import type { ExtractionPort, Override, Trace } from "@bones/core";
import { describe, expect, it } from "vitest";
import { buildCaseExport, downloadText, exportFileName, exportTrace } from "../../src/export/exportTrace";
import { makePortFactory } from "../../src/pipeline/ports";
import { runCasePipeline } from "../../src/pipeline/runCasePipeline";
import type { RuleBundle } from "../../src/rules/catalog";
import type { AccusationRecord } from "../../src/state/accusation";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle, readRecorded } from "../helpers/fixtures";

const loaded = loadTestBundle();
if (isCoreError(loaded)) throw new Error(JSON.stringify(loaded));
const bundle: RuleBundle = loaded;

async function makeTrace(): Promise<Trace> {
  const entry = readRecorded()[0]!.json as { extraction: { rawModelOutput: string } & Record<string, unknown> };
  const raw = entry.extraction.rawModelOutput;
  const adapter: ExtractionPort = {
    extract: async () => entry.extraction as unknown as Awaited<ReturnType<ExtractionPort["extract"]>>,
  };
  const t = await runCasePipeline({
    input: { raw },
    adapter,
    versionLabel: "v1",
    bundle,
    portFactory: makePortFactory(counterPorts()),
  });
  if (isCoreError(t)) throw new Error(JSON.stringify(t));
  return t;
}

const ov = (n: number): Override => ({
  decisionId: "d",
  reviewerName: `R${n}`,
  reason: `reason ${n}`,
  replacementResult: "approved",
  createdAt: new Date(1_700_000_000_000 + n).toISOString(),
});

describe("trace export", () => {
  it("contains the accusation record when present and null otherwise", async () => {
    const trace = await makeTrace();
    const rec: AccusationRecord = {
      decisionId: trace.decisionId,
      ruleSetVersion: trace.ruleSetVersion,
      suspectId: "s1",
      verdict: "correct",
      proofRuleIds: ["proof-means:s1"],
      createdAt: "2023-11-14T22:13:20.000Z",
    };
    expect(JSON.parse(exportTrace(trace, [], rec)).accusation).toEqual(rec);
    expect(JSON.parse(exportTrace(trace, [], null)).accusation).toBeNull();
    expect(JSON.parse(exportTrace(trace, [], null)).trace.decisionId).toBe(trace.decisionId);
  });

  it("keeps the order of the overrides", async () => {
    const trace = await makeTrace();
    const list = [ov(3), ov(1), ov(2)];
    const file = buildCaseExport(trace, list, null);
    expect(file.overrides.map((o) => o.reviewerName)).toEqual(["R3", "R1", "R2"]);
    expect(JSON.parse(exportTrace(trace, list, null)).overrides.map((o: Override) => o.reviewerName)).toEqual([
      "R3",
      "R1",
      "R2",
    ]);
  });

  it("names the file after the decision id and downloads without throwing", async () => {
    const trace = await makeTrace();
    expect(exportFileName(trace)).toBe(`case-trace-${trace.decisionId.slice(0, 8)}.json`);
    const calls: string[] = [];
    const anchor = { href: "", download: "", click: () => calls.push("click") };
    downloadText("x.json", "{}", {
      createBlob: () => ({}) as Blob,
      createObjectURL: () => "blob:x",
      revokeObjectURL: () => calls.push("revoke"),
      createAnchor: () => anchor,
    });
    expect(calls).toEqual(["click", "revoke"]);
    expect(anchor.download).toBe("x.json");
    expect(() => downloadText("x", "y", ({}) as never)).not.toThrow();
  });
});
