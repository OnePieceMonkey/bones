import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { SAMPLE_FILM_LINES, SAMPLE_IDS, SAMPLES } from "../../src/extraction/samples";

const FORBIDDEN = ["approved", "rejected", "denied", "capped", "deduct"];
const RESULT_LABELS = ["approved", "partially approved", "rejected"];

describe("film sheet text", () => {
  // Feature: visual-polish, Property 22: Film sheet text is short and reveals no result
  // **Validates: Requirements 16.3, 16.4, 16.5**
  it("is short, one line and reveals no result for every sample id", () => {
    const titles = new Map(
      (SAMPLES as Array<{ id: string; title: string }>).map((s) => [s.id, s.title]),
    );
    fc.assert(
      fc.property(fc.constantFrom(...SAMPLE_IDS), (id) => {
        const line = SAMPLE_FILM_LINES[id];
        const title = titles.get(id) ?? "";
        expect(title.length).toBeGreaterThan(0);
        expect(title.length).toBeLessThanOrEqual(60);
        expect(line.length).toBeGreaterThan(0);
        expect(line.length).toBeLessThanOrEqual(120);
        expect(line).not.toMatch(/[\r\n]/);
        for (const text of [line, title]) {
          const lower = text.toLowerCase();
          for (const w of [...FORBIDDEN, ...RESULT_LABELS]) expect(lower).not.toContain(w);
        }
      }),
      { numRuns: 100 },
    );
  });
});
