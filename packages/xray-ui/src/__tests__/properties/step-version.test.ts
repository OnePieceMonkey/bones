// Feature: xray-ui, Property 12: Knob stepping never leaves the version list
// **Validates: Requirements 7.3, 7.4, 7.5**
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { stepVersion } from "../../model/gauge";

const KEYS = ["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown", "Home", "End"] as const;

const versionsArb = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), {
  minLength: 1,
  maxLength: 8,
});

const caseArb = versionsArb.chain((versions) =>
  fc.record({
    versions: fc.constant(versions),
    index: fc.integer({ min: 0, max: versions.length - 1 }),
    key: fc.oneof(
      fc.constantFrom(...KEYS),
      fc.string({ maxLength: 8 }),
    ),
  }),
);

describe("Property 12: stepVersion", () => {
  it("returns null or a member; arrows step by one; Home/End jump; boundaries return null", () => {
    fc.assert(
      fc.property(caseArb, ({ versions, index, key }) => {
        const value = versions[index] as string;
        const out = stepVersion(versions, value, key);
        if (out !== null) expect(versions).toContain(out);

        const last = versions.length - 1;
        switch (key) {
          case "ArrowRight":
          case "ArrowUp":
            expect(out).toBe(index < last ? versions[index + 1] : null);
            break;
          case "ArrowLeft":
          case "ArrowDown":
            expect(out).toBe(index > 0 ? versions[index - 1] : null);
            break;
          case "Home":
            expect(out).toBe(index === 0 ? null : versions[0]);
            break;
          case "End":
            expect(out).toBe(index === last ? null : versions[last]);
            break;
          default:
            expect(out).toBeNull();
        }
      }),
      { numRuns: 200 },
    );
  });

  it("empty list and unknown value never yield a non-member", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ maxLength: 6 }), { maxLength: 6 }),
        fc.string({ maxLength: 6 }),
        fc.oneof(fc.constantFrom(...KEYS), fc.string({ maxLength: 8 })),
        (versions, value, key) => {
          const out = stepVersion(versions, value, key);
          if (out !== null) expect(versions).toContain(out);
          if (versions.length === 0) expect(out).toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });
});
