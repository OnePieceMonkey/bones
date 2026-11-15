import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CoreError } from "@bones/core";
import { buildBundle } from "../../src/rules/catalog";
import type { RuleBundle } from "../../src/rules/catalog";

const here = dirname(fileURLToPath(import.meta.url));
export const rulesRoot = resolve(here, "../../../../rules/expense-auditor");

/** Reads every JSON file of a rules sub-folder, keyed by file name. */
export function readRuleDir(dir: "rules" | "rule-sets"): Record<string, unknown> {
  const base = resolve(rulesRoot, dir);
  const out: Record<string, unknown> = {};
  for (const name of readdirSync(base).filter((n) => n.endsWith(".json")).sort()) {
    out[name] = JSON.parse(readFileSync(resolve(base, name), "utf8"));
  }
  return out;
}

/** Builds the bundle from the real rule files with node:fs. */
export function loadTestBundle(): RuleBundle | CoreError {
  return buildBundle(readRuleDir("rules"), readRuleDir("rule-sets"));
}

// ---- pipeline fixtures (task 14.2) ----
import { isCoreError } from "@bones/core";
import type { Anatomy } from "@bones/xray-ui";
import type { Trace } from "@bones/core";
import { RecordedSampleAdapter } from "../../src/extraction/RecordedSampleAdapter";
import { SAMPLES, sampleSchema } from "../../src/extraction/samples";
import type { Sample, SampleId } from "../../src/extraction/samples";
import { replayTrace, runPipeline } from "../../src/pipeline/runPipeline";
import type { VersionLabel } from "../../src/pipeline/runPipeline";
import { makePortFactory } from "../../src/pipeline/ports";
import { initialReplayStore, putReplay } from "../../src/pipeline/replayStore";
import type { DecisionState } from "../../src/state/reducer";
import { counterPorts } from "./fakes";

/** Parses a bundled Sample. Throws when the id is unknown (test setup error). */
export function loadSample(id: SampleId): Sample {
  const entry = SAMPLES.find((s) => (s as { id?: unknown }).id === id);
  return sampleSchema.parse(entry);
}

/** Runs the real pipeline for a Sample with fixed ports and the real SHA-256 over the receipt text bytes. */
export async function sampleTrace(id: SampleId, label: VersionLabel): Promise<Trace> {
  const sample = loadSample(id);
  const bundle = loadTestBundle();
  if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));
  const bytes = new TextEncoder().encode(sample.receiptText);
  const result = await runPipeline({
    input: { raw: sample.receiptText, bytes },
    adapter: new RecordedSampleAdapter(id),
    trip: sample.trip,
    ruleSetLabel: label,
    bundle,
    portFactory: makePortFactory(counterPorts()),
  });
  if (isCoreError(result)) throw new Error(JSON.stringify(result));
  return result;
}

/** Anatomy for the five expense rules, as in the design (labels and regions only). */
export const testAnatomy: Anatomy = {
  bones: [
    { ruleId: "date-blocking-before", label: "Date before trip", region: "spine" },
    { ruleId: "date-blocking-after", label: "Date after trip", region: "spine" },
    { ruleId: "alcohol-deducting", label: "Alcohol", region: "pelvis" },
    { ruleId: "meal-limit", label: "Meal limit", region: "ribs" },
    { ruleId: "line-item-cap", label: "Line-item match", region: "arm-right" },
  ],
  fieldLabels: {},
};

/**
 * DecisionState for the signature sample at v1 with the v2 and v3 replays stored.
 * One port factory is shared, so the three Traces have distinct decisionIds.
 */
export async function signatureDecisionState(): Promise<DecisionState> {
  const sample = loadSample("signature");
  const bundle = loadTestBundle();
  if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));
  const factory = makePortFactory(counterPorts());
  const original = await runPipeline({
    input: { raw: sample.receiptText, bytes: new TextEncoder().encode(sample.receiptText) },
    adapter: new RecordedSampleAdapter("signature"),
    trip: sample.trip,
    ruleSetLabel: "v1",
    bundle,
    portFactory: factory,
  });
  if (isCoreError(original)) throw new Error(JSON.stringify(original));
  let replays = initialReplayStore(original);
  for (const label of ["v2", "v3"] as const) {
    const t = replayTrace({ original, label, bundle, ports: factory.base });
    if (isCoreError(t)) throw new Error(JSON.stringify(t));
    replays = putReplay(replays, label, t);
  }
  return {
    screen: "decision",
    sessionId: "session-1",
    origin: { kind: "sample", sampleId: "signature" },
    trip: sample.trip,
    source: { kind: "text", text: sample.receiptText },
    original,
    replays,
    selected: "v1",
    overrides: [],
    intro: { xray: false, pending: true },
    notice: null,
  };
}
