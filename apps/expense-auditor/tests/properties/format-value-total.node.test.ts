// Feature: expense-auditor, Property 16: formatValue is total
// **Validates: Requirements 11.5, 11.6, 11.7**
import { defaultFormat } from "@bones/xray-ui";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatValue } from "../../src/format/formatValue";

const cyclic = (): unknown => {
  const a: Record<string, unknown> = { name: "a" };
  a.self = a;
  return a;
};

const arbValue: fc.Arbitrary<unknown> = fc.oneof(
  fc.anything(),
  fc.constant(undefined),
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(cyclic()),
  fc.constant(() => 1),
  fc.constant(Symbol("s")),
  fc.constant(10n),
  fc.constant(Object.create(null) as unknown),
);

const arbPath: fc.Arbitrary<string> = fc.oneof(
  fc.string(),
  fc.constantFrom("lineItems", "alcoholLineItems", "claimedTotalCents", "amount", "x_sum", "receiptDate", "tripStart", "tripEnd"),
);

describe("Property 16: formatValue is total", () => {
  it("never throws and always returns a string", () => {
    fc.assert(
      fc.property(arbPath, arbValue, (path, value) => {
        const out = formatValue(path, value);
        expect(typeof out).toBe("string");
      }),
      { numRuns: 300 },
    );
  });

  it("equals defaultFormat when no rule matches", () => {
    fc.assert(
      fc.property(
        fc.string().filter((p) => !/Cents$/.test(p) && !p.endsWith("_sum") && p !== "amount"),
        arbValue.filter((v) => typeof v !== "boolean"),
        (path, value) => {
          fc.pre(!["lineItems", "alcoholLineItems", "receiptDate", "tripStart", "tripEnd"].includes(path));
          expect(formatValue(path, value)).toBe(defaultFormat(path, value));
        },
      ),
      { numRuns: 300 },
    );
  });
});
