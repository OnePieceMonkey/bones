import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { boneKey, newlyFractured } from "../../model/fractureDiff";

const key = fc
  .tuple(fc.constantFrom("r1", "r2", "r3", "r4", "r5"), fc.integer({ min: 0, max: 3 }))
  .map(([id, i]) => boneKey(id, i));
const keySet = fc.uniqueArray(key, { maxLength: 12 }).map((a) => new Set(a));

describe("newlyFractured", () => {
  it("Property 16: fracture moments play only for newly fractured bones", () => {
    // Feature: visual-polish, Property 16: Fracture moments play only for newly fractured bones
    // Validates: Requirements 13.6
    fc.assert(
      fc.property(keySet, keySet, (prev, next) => {
        const result = newlyFractured(prev, next);
        const expected = [...next].filter((k) => !prev.has(k));
        expect(result).toEqual(expected);
        for (const k of result) {
          expect(next.has(k)).toBe(true);
          expect(prev.has(k)).toBe(false);
        }
        if ([...next].every((k) => prev.has(k))) expect(result).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });

  it("builds keys as ruleId:index and ignores bones fractured in both versions", () => {
    expect(boneKey("limit", 2)).toBe("limit:2");
    const prev = new Set(["a:0", "b:0"]);
    const next = new Set(["b:0", "c:1"]);
    expect(newlyFractured(prev, next)).toEqual(["c:1"]);
  });
});
