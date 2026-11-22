import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { render, screen, cleanup } from "@testing-library/react";
import { ResultFooter } from "../../components/panels/ResultFooter";
import type { DecisionResult } from "../../types";
import { progressShare } from "../../model/progress";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

const money = (_p: string, v: unknown) => `$${((v as number) / 100).toFixed(2)}`;
const anatomy = () => ({ ...signatureAnatomy(), formatValue: money });

// Feature: visual-polish-2, Property 6: Progress share and bar
// **Validates: Requirements 6.5, 6.6**
describe("progress bar property", () => {
  it("share is in 0..1, aria-valuenow is round(100 * share), fill scaleX is the share, result line is upper case", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5_000_000 }),
        fc.integer({ min: 1, max: 5_000_000 }),
        fc.constantFrom<DecisionResult[]>("approved", "partially_approved", "rejected"),
        (approved, claimed, result) => {
          const share = progressShare(approved, claimed);
          expect(share).toBeGreaterThanOrEqual(0);
          expect(share).toBeLessThanOrEqual(1);
          const trace = { ...signatureTrace(), result, amountCents: approved };
          render(<ResultFooter trace={trace} anatomy={anatomy()} claimedCents={claimed} />);
          const bar = screen.getByRole("progressbar");
          expect(bar.getAttribute("aria-valuenow")).toBe(String(Math.round(100 * share)));
          expect((bar.firstElementChild as HTMLElement).style.transform).toBe(`scaleX(${share})`);
          const line = screen.getByRole("status").querySelector(".xr-result-line")!.textContent!;
          expect(line).toBe(line.toUpperCase());
          expect(line).toBe(`${result.replace("_", " ").toUpperCase()} ${money("amountCents", approved)}`);
          cleanup();
        },
      ),
      { numRuns: 100 },
    );
  });
});
