import { guardInput } from "@bones/core";
import type { CoreError, ExtractionPort, ExtractionResult, RawInput } from "@bones/core";
import { SAMPLES, sampleSchema } from "./samples";

/** Replays a bundled Sample. Browser-safe twin of Core's Node `RecordedAdapter`. */
export class RecordedSampleAdapter implements ExtractionPort {
  constructor(
    private readonly sampleId: string,
    private readonly samples: readonly unknown[] = SAMPLES,
  ) {}

  async extract(input: RawInput): Promise<ExtractionResult | CoreError> {
    const guard = guardInput(input);
    if (guard !== null) return guard;

    const fixturePath = `recorded/${this.sampleId}.json`;
    const entry = this.samples.find(
      (s) => typeof s === "object" && s !== null && (s as { id?: unknown }).id === this.sampleId,
    );
    if (entry === undefined) {
      return {
        kind: "fixture_not_found",
        message: `Sample not found: ${this.sampleId}`,
        fixturePath,
      };
    }

    const parsed = sampleSchema.safeParse(entry);
    if (!parsed.success) {
      return {
        kind: "fixture_invalid",
        message: `Sample is invalid: ${this.sampleId}`,
        fixturePath,
        parseError: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      };
    }

    // Return the original data, not Zod's output; clone so imported JSON stays unfrozen.
    return structuredClone((entry as { extraction: ExtractionResult }).extraction);
  }
}
