import { isCoreError } from "@bones/core";
import type { ExtractionPort, ExtractionResult } from "@bones/core";
import { describe, expect, it, vi } from "vitest";
import { sha256Hex } from "../../src/pipeline/hash";
import { makePortFactory } from "../../src/pipeline/ports";
import { runCasePipeline } from "../../src/pipeline/runCasePipeline";
import type { VersionLabel } from "../../src/rules/catalog";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle, readRecorded } from "../helpers/fixtures";

const bundle = loadTestBundle();
if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));
const recorded = new Map(readRecorded().map((r) => [r.json.id, r.json]));

const fixed = (extraction: ExtractionResult): ExtractionPort => ({ extract: async () => structuredClone(extraction) });
const run = (adapter: ExtractionPort, versionLabel: VersionLabel = "v1", sha256?: (b: Uint8Array) => Promise<string>) =>
  runCasePipeline({
    input: { raw: "case" },
    adapter,
    versionLabel,
    bundle,
    portFactory: makePortFactory(counterPorts()),
    ...(sha256 === undefined ? {} : { sha256 }),
  });
const base = () => structuredClone(recorded.get("greenhouse")!.extraction) as ExtractionResult;

describe("runCasePipeline", () => {
  it("builds a Trace with the fields of requirement 9.3", async () => {
    const ex = base();
    const t = await run(fixed(ex));
    if (isCoreError(t)) throw new Error(JSON.stringify(t));
    expect(t.rawModelOutput).toBe(ex.rawModelOutput);
    expect(t.proposedFields).toEqual(ex.proposedFields);
    expect(t.confidence).toEqual(ex.confidence);
    expect(t.ruleSetId).toBe("case-files");
    expect(t.ruleSetVersion).toBe("1.0.0");
    expect(t.ruleOutcomes.length).toBeGreaterThan(0);
    expect(t.validatedFields).not.toHaveProperty("confidence");
    expect(t.validatedFields).toHaveProperty("suspects");
  });

  it("hashes the UTF-8 bytes of rawModelOutput", async () => {
    const ex = base();
    const t = await run(fixed(ex));
    if (isCoreError(t)) throw new Error(JSON.stringify(t));
    expect(t.inputHash).toBe(await sha256Hex(new TextEncoder().encode(ex.rawModelOutput)));
  });

  it("deep-freezes the Trace", async () => {
    const t = await run(fixed(base()));
    if (isCoreError(t)) throw new Error(JSON.stringify(t));
    expect(Object.isFrozen(t)).toBe(true);
    expect(Object.isFrozen(t.ruleOutcomes)).toBe(true);
    expect(() => {
      (t as { result: string }).result = "approved";
    }).toThrow();
  });

  it("returns validation_failed for invalid JSON text and for a schema failure, with no Trace", async () => {
    const badJson = { ...base(), rawModelOutput: "{not json" };
    const a = await run(fixed(badJson));
    expect(isCoreError(a) && a.kind).toBe("validation_failed");
    const ex = base();
    (ex.proposedFields as Record<string, unknown>).culprit = "x";
    const b = await run(fixed(ex));
    expect(isCoreError(b) && b.kind).toBe("validation_failed");
  });

  it("returns input_too_large above 32,768 bytes before parsing", async () => {
    const ex = { ...base(), rawModelOutput: "x".repeat(32_769) };
    const e = await run(fixed(ex));
    expect(isCoreError(e) && e.kind).toBe("input_too_large");
    if (isCoreError(e) && e.kind === "input_too_large") {
      expect(e.byteLength).toBe(32_769);
      expect(e.maxBytes).toBe(32_768);
    }
  });

  it("passes an adapter error through and runs no later step", async () => {
    const sha = vi.fn(async () => "0".repeat(64));
    const adapter: ExtractionPort = { extract: async () => ({ kind: "fixture_not_found", message: "m", fixturePath: "p" }) };
    const e = await run(adapter, "v1", sha);
    expect(isCoreError(e) && e.kind).toBe("fixture_not_found");
    expect(sha).not.toHaveBeenCalled();
  });

  it("does not hash when validation fails", async () => {
    const sha = vi.fn(async () => "0".repeat(64));
    await run(fixed({ ...base(), rawModelOutput: "{" }), "v1", sha);
    expect(sha).not.toHaveBeenCalled();
  });

  it("maps a failing hasher to a CoreError", async () => {
    const e = await run(fixed(base()), "v1", async () => {
      throw new Error("boom");
    });
    expect(isCoreError(e) && e.kind).toBe("invalid_replay_arguments");
  });

  it("matches the nine-cell matrix through the real pipeline", async () => {
    const { EXPECTED_MATRIX } = await import("../fixtures/expected-matrix");
    for (const cell of EXPECTED_MATRIX) {
      const t = await run(fixed(structuredClone(recorded.get(cell.caseId)!.extraction) as ExtractionResult), cell.label);
      if (isCoreError(t)) throw new Error(JSON.stringify(t));
      expect(t.result, `${cell.caseId} ${cell.label}`).toBe(cell.verdict === "accepted" ? "approved" : "rejected");
      expect(t.amountCents, `${cell.caseId} ${cell.label}`).toBe(cell.convictable.length);
    }
  });
});
