import { describe, expect, it } from "vitest";
import { RecordedSampleAdapter } from "../../src/extraction/RecordedSampleAdapter";
import { SAMPLES } from "../../src/extraction/samples";

const signature = SAMPLES[0] as { id: string; extraction: unknown };

describe("RecordedSampleAdapter", () => {
  it("returns input_empty for empty input without reading any Sample", async () => {
    const trap = new Proxy([] as unknown[], {
      get(target, prop, receiver) {
        if (prop === "find" || prop === "filter" || prop === "some") throw new Error("samples were read");
        return Reflect.get(target, prop, receiver);
      },
    });
    const result = await new RecordedSampleAdapter("signature", trap).extract("");
    expect(result).toMatchObject({ kind: "input_empty" });
  });

  it("returns fixture_not_found for an unknown id", async () => {
    const result = await new RecordedSampleAdapter("nope").extract("x");
    expect(result).toMatchObject({ kind: "fixture_not_found", fixturePath: "recorded/nope.json" });
  });

  it("returns fixture_invalid when claimedTotalCents is a string (value and confidence)", async () => {
    const bad = structuredClone(signature) as any;
    // sampleSchema types proposedFields as a loose record, so the string value
    // is only rejected through its typed neighbour: the confidence record.
    bad.extraction.proposedFields.claimedTotalCents = "48000";
    bad.extraction.confidence.claimedTotalCents = "48000";
    const result = await new RecordedSampleAdapter("signature", [bad]).extract("x");
    expect(result).toMatchObject({ kind: "fixture_invalid", fixturePath: "recorded/signature.json" });
    expect((result as { parseError: string }).parseError.length).toBeGreaterThan(0);
  });

  it("returns a deep-equal copy that is not the same reference", async () => {
    const result = await new RecordedSampleAdapter("signature").extract("x");
    expect(result).toEqual(signature.extraction);
    expect(result).not.toBe(signature.extraction);
  });
});
