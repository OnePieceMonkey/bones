import { isCoreError } from "@bones/core";
import type { ExtractionPort, ExtractionResult } from "@bones/core";
import { describe, expect, it } from "vitest";
import { deriveFacts } from "../../src/derive/factDeriver";
import { makePortFactory } from "../../src/pipeline/ports";
import { runCasePipeline } from "../../src/pipeline/runCasePipeline";
import { modelOutputSchema, extractCaseFields } from "../../src/pipeline/schema";
import { solve } from "../../src/solver/solve";
import { EXPECTED_MATRIX } from "../fixtures/expected-matrix";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle, readRecorded } from "../helpers/fixtures";

const bundle = loadTestBundle();
if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));
const recorded = new Map(readRecorded().map((r) => [r.json.id, r.json]));

describe("expected verdict matrix (Solver on the three recorded cases)", () => {
  for (const cell of EXPECTED_MATRIX) {
    it(`${cell.caseId} ${cell.label}: ${cell.verdict} [${cell.convictable.join(", ")}]`, () => {
      const entry = recorded.get(cell.caseId);
      expect(entry).toBeDefined();
      const parsed = modelOutputSchema.parse(entry!.extraction.proposedFields);
      const result = solve(deriveFacts(extractCaseFields(parsed)), cell.label, bundle);
      if (isCoreError(result)) throw new Error(JSON.stringify(result));
      expect(result.verdict).toBe(cell.verdict);
      expect(result.convictable).toEqual(cell.convictable);
    });
  }

  // Task 4.3: the same nine cells through the real pipeline (trace result and amount).
  for (const cell of EXPECTED_MATRIX) {
    it(`pipeline ${cell.caseId} ${cell.label}: result and amountCents`, async () => {
      const entry = recorded.get(cell.caseId)!;
      const adapter: ExtractionPort = {
        extract: async () => structuredClone(entry.extraction) as ExtractionResult,
      };
      const trace = await runCasePipeline({
        input: { raw: "case" },
        adapter,
        versionLabel: cell.label,
        bundle,
        portFactory: makePortFactory(counterPorts()),
      });
      if (isCoreError(trace)) throw new Error(JSON.stringify(trace));
      expect(trace.result).toBe(cell.verdict === "accepted" ? "approved" : "rejected");
      expect(trace.amountCents).toBe(cell.convictable.length);
    });
  }
});
