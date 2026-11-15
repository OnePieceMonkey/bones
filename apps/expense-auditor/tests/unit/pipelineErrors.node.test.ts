import { describe, expect, it } from "vitest";
import { isCoreError } from "@bones/core";
import type { CoreError, ExtractionResult } from "@bones/core";
import { fakeAdapter, counterPorts } from "../helpers/fakes";
import { loadSample, loadTestBundle } from "../helpers/fixtures";
import { makePortFactory } from "../../src/pipeline/ports";
import type { PortFactory } from "../../src/pipeline/ports";
import { runPipeline } from "../../src/pipeline/runPipeline";
import type { RuleBundle } from "../../src/pipeline/runPipeline";
import { RecordedSampleAdapter } from "../../src/extraction/RecordedSampleAdapter";

const sample = loadSample("signature");
const bytes = new TextEncoder().encode(sample.receiptText);
const input = { raw: sample.receiptText, bytes };

function bundle(): RuleBundle {
  const b = loadTestBundle();
  if (isCoreError(b)) throw new Error(JSON.stringify(b));
  return b;
}

/** A bundle whose property reads are counted. */
function spyBundle(): { bundle: RuleBundle; reads: string[] } {
  const reads: string[] = [];
  const proxy = new Proxy(bundle(), {
    get(target, prop, receiver) {
      reads.push(String(prop));
      return Reflect.get(target, prop, receiver);
    },
  });
  return { bundle: proxy, reads };
}

function isDeepFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(isDeepFrozen);
}

function expectCoreError(r: unknown): CoreError {
  expect(isCoreError(r)).toBe(true);
  return r as CoreError;
}

describe("runPipeline error paths", () => {
  it("returns the adapter's input_empty error and never reads the bundle", async () => {
    const spy = spyBundle();
    const r = await runPipeline({
      input: { raw: "", bytes: new Uint8Array() },
      adapter: new RecordedSampleAdapter("signature"),
      trip: sample.trip,
      ruleSetLabel: "v1",
      bundle: spy.bundle,
      portFactory: makePortFactory(counterPorts()),
    });
    expect(expectCoreError(r).kind).toBe("input_empty");
    expect(spy.reads).toEqual([]);
  });

  it("returns validation_failed for an invalid proposal and never reads the bundle", async () => {
    const bad: ExtractionResult = {
      ...sample.extraction,
      proposedFields: { ...sample.extraction.proposedFields, claimedTotalCents: "480" },
    };
    const spy = spyBundle();
    const r = await runPipeline({
      input,
      adapter: fakeAdapter(bad),
      trip: sample.trip,
      ruleSetLabel: "v1",
      bundle: spy.bundle,
      portFactory: makePortFactory(counterPorts()),
    });
    expect(expectCoreError(r).kind).toBe("validation_failed");
    expect(spy.reads).toEqual([]);
  });

  it("returns invalid_replay_arguments when forInput(hex, 5) meets 6 bytes", async () => {
    const real = makePortFactory(counterPorts());
    const factory: PortFactory = {
      base: real.base,
      forInput: (hex) => real.forInput(hex, 5),
    };
    const r = await runPipeline({
      input: { raw: "abcdef", bytes: new TextEncoder().encode("abcdef") },
      adapter: fakeAdapter(sample.extraction),
      trip: sample.trip,
      ruleSetLabel: "v1",
      bundle: bundle(),
      portFactory: factory,
    });
    expect(expectCoreError(r)).toMatchObject({ kind: "invalid_replay_arguments", missingField: "hasher" });
  });

  it("turns a rejecting sha256 into the hasher error", async () => {
    const r = await runPipeline({
      input,
      adapter: fakeAdapter(sample.extraction),
      trip: sample.trip,
      ruleSetLabel: "v1",
      bundle: bundle(),
      portFactory: makePortFactory(counterPorts()),
      sha256: () => Promise.reject(new Error("no subtle")),
    });
    expect(expectCoreError(r)).toMatchObject({ kind: "invalid_replay_arguments", missingField: "hasher" });
  });
});

describe("runPipeline success trace", () => {
  it("is deep-frozen, carries the injected ports and hashes the receipt text bytes", async () => {
    const r = await runPipeline({
      input,
      adapter: new RecordedSampleAdapter("signature"),
      trip: sample.trip,
      ruleSetLabel: "v1",
      bundle: bundle(),
      portFactory: makePortFactory(counterPorts()),
    });
    if (isCoreError(r)) throw new Error(JSON.stringify(r));
    expect(isDeepFrozen(r)).toBe(true);
    expect(r.traceSchemaVersion).toBe("1");
    expect(r.decisionId).toBe("id-1");
    expect(r.createdAt).toBe(new Date(1_700_000_000_000).toISOString());
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    expect(r.inputHash).toBe(hex);
  });
});
