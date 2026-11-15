import { describe, expect, it } from "vitest";
import { formatDate, formatTripWindow, isRealIsoDate } from "../../src/format/dates";
import { formatValue } from "../../src/format/formatValue";
import { formatCents } from "../../src/format/money";

const items = (...amounts: number[]) => amounts.map((amount, i) => ({ description: `Item ${i}`, amount }));

describe("format helpers", () => {
  it("formats cents as dollars", () => {
    expect(formatCents(4150)).toBe("$41.50");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(123456789)).toBe("$1,234,567.89");
  });

  it("formats dates and keeps raw text for non-dates", () => {
    expect(formatDate("2024-03-15")).toBe("Mar 15, 2024");
    expect(formatDate("2024-03-05")).toBe("Mar 5, 2024");
    expect(formatDate("yesterday")).toBe("yesterday");
    expect(formatDate("2023-02-29")).toBe("2023-02-29");
  });

  it("applies the Gregorian leap rule", () => {
    expect(isRealIsoDate("2024-02-29")).toBe(true);
    expect(isRealIsoDate("2023-02-29")).toBe(false);
    expect(isRealIsoDate("1900-02-29")).toBe(false);
    expect(isRealIsoDate("2000-02-29")).toBe(true);
    expect(isRealIsoDate("2024-13-01")).toBe(false);
    expect(isRealIsoDate("2024-04-31")).toBe(false);
  });

  it("formats trip windows", () => {
    expect(formatTripWindow({ start: "2024-03-10", end: "2024-03-20" })).toBe("Trip: Mar 10 - Mar 20, 2024");
    expect(formatTripWindow({ start: "2024-12-28", end: "2025-01-05" })).toBe("Trip: Dec 28, 2024 - Jan 5, 2025");
  });

  it("summarises line items without raw JSON", () => {
    const four = formatValue("lineItems", items(1000, 1000, 1400, 1400));
    expect(four).toBe("4 line items · $48.00");
    expect(formatValue("lineItems", items(650))).toBe("1 line item · $6.50");
    expect(formatValue("alcoholLineItems", [])).toBe("No line items · $0.00");
    for (const out of [four, formatValue("lineItems", items(650)), formatValue("lineItems", [])]) {
      expect(out).not.toMatch(/[{[]/);
    }
  });

  it("formats cents paths, dates and booleans", () => {
    expect(formatValue("claimedTotalCents", 4150)).toBe("$41.50");
    expect(formatValue("alcoholLineItems[*].amount_sum", 1200)).toBe("$12.00");
    expect(formatValue("receiptDate", "2024-03-15")).toBe("Mar 15, 2024");
    expect(formatValue("hasReceipt", true)).toBe("Yes");
    expect(formatValue("hasReceipt", false)).toBe("No");
  });

  it("falls back to the default formatter for unknown paths", () => {
    expect(formatValue("merchant", "Cafe Luna")).toBe("Cafe Luna");
    expect(formatValue("unknown", 7)).toBe("7");
    expect(formatValue("claimedTotalCents", 1.5)).toBe("1.5");
  });

  it("never prints EUR", () => {
    expect(formatCents(100)).not.toContain("EUR");
    expect(formatValue("claimedTotalCents", 100)).not.toContain("EUR");
    expect(formatValue("lineItems", items(100))).not.toContain("EUR");
  });
});
