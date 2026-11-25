import { guardInput } from "@bones/core";
import type { CoreError, ExtractionPort, ExtractionResult, RawInput } from "@bones/core";
import { RECORDED_CASES, recordedCaseSchema } from "./samples";
import type { RecordedCaseId } from "./samples";

/** Replays a bundled Recorded_Case. Browser-safe twin of Core's Node `RecordedAdapter`. No network. */
export class RecordedCaseAdapter implements ExtractionPort {
  constructor(
    private readonly caseId: RecordedCaseId,
    private readonly cases: readonly unknown[] = RECORDED_CASES,
  ) {}

  async extract(input: RawInput): Promise<ExtractionResult | CoreError> {
    const guard = guardInput(input);
    if (guard !== null) return guard;
    const fixturePath = `recorded/${this.caseId}.json`;
    const entry = this.cases.find(
      (c) => typeof c === "object" && c !== null && (c as { id?: unknown }).id === this.caseId,
    );
    if (entry === undefined) {
      return { kind: "fixture_not_found", message: `Recorded case not found: ${this.caseId}`, fixturePath };
    }
    const parsed = recordedCaseSchema.safeParse(entry);
    if (!parsed.success) {
      return {
        kind: "fixture_invalid",
        message: `Recorded case is invalid: ${this.caseId}`,
        fixturePath,
        parseError: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      };
    }
    // Return the original data, not Zod's output; clone so imported JSON stays unfrozen.
    return structuredClone((entry as { extraction: ExtractionResult }).extraction);
  }
}
