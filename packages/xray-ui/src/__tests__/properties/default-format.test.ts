// Feature: xray-ui, Property 14: Default formatter is total
// **Validates: Requirements 2.16, 8.5**
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { defaultFormat, safeFormat } from "../../model/format";
import type { Anatomy } from "../../types";

function cyclic(): unknown {
  const a: Record<string, unknown> = { name: "loop" };
  a.self = a;
  return a;
}

const valueArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.anything(),
  fc.anything({ withBigInt: true, withDate: true, withNullPrototype: true, withObjectString: true }),
  fc.constantFrom<unknown>(
    undefined,
    null,
    Symbol("s"),
    Symbol.for("k"),
    () => 1,
    cyclic(),
    Object.create(null),
    [cyclic()],
    10n,
    NaN,
    Infinity,
    { toString: () => { throw new Error("boom"); }, toJSON: () => { throw new Error("boom"); } },
  ),
);

function anatomyWith(formatValue?: (p: string, v: unknown) => unknown): Anatomy {
  return { bones: [], fieldLabels: {}, formatValue } as unknown as Anatomy;
}

describe("Property 14: defaultFormat / safeFormat totality", () => {
  it("defaultFormat never throws and returns a string", () => {
    fc.assert(
      fc.property(fc.string(), valueArb, (path, value) => {
        const out = defaultFormat(path, value);
        expect(typeof out).toBe("string");
        if (typeof value === "string") expect(out).toBe(value);
        if (typeof value === "number") expect(out).toBe(String(value));
      }),
      { numRuns: 200 },
    );
  });

  it("safeFormat falls back to defaultFormat for throwing or non-string formatValue", () => {
    const badFormatters: Array<(p: string, v: unknown) => unknown> = [
      () => { throw new Error("host failure"); },
      () => 42,
      () => undefined,
      () => null,
      () => ({}),
    ];
    fc.assert(
      fc.property(
        fc.string(),
        valueArb,
        fc.constantFrom(...badFormatters),
        (path, value, bad) => {
          const out = safeFormat(anatomyWith(bad))(path, value);
          expect(typeof out).toBe("string");
          expect(out).toBe(defaultFormat(path, value));
        },
      ),
      { numRuns: 200 },
    );
  });

  it("safeFormat uses defaultFormat when formatValue is absent", () => {
    fc.assert(
      fc.property(fc.string(), valueArb, (path, value) => {
        expect(safeFormat(anatomyWith())(path, value)).toBe(defaultFormat(path, value));
      }),
      { numRuns: 100 },
    );
  });
});
