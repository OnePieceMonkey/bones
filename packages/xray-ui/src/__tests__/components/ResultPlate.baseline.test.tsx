import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ResultPlate } from "../../components/ResultPlate";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";
import type { DecisionResult } from "../../types";

// Markup captured from ResultPlate before the `effective` prop was added.
const baseline: Array<[DecisionResult, string]> = [
  [
    "approved",
    '<div class="xr-result" data-result="approved" role="status"><span class="xr-result-icon" aria-hidden="true">✓</span><span class="xr-result-label">APPROVED</span><span class="xr-result-amount">4150</span></div>',
  ],
  [
    "partially_approved",
    '<div class="xr-result" data-result="partially_approved" role="status"><span class="xr-result-icon" aria-hidden="true">◐</span><span class="xr-result-label">PARTIALLY APPROVED</span><span class="xr-result-amount">4150</span></div>',
  ],
  [
    "rejected",
    '<div class="xr-result" data-result="rejected" role="status"><span class="xr-result-icon" aria-hidden="true">✕</span><span class="xr-result-label">REJECTED</span><span class="xr-result-amount">4150</span></div>',
  ],
];

describe("ResultPlate baseline markup (no effective prop)", () => {
  it.each(baseline)("renders the stored markup for %s", (result, html) => {
    const trace = { ...signatureTrace(), result };
    const { container } = render(<ResultPlate trace={trace} anatomy={signatureAnatomy()} />);
    expect(container.innerHTML).toBe(html);
  });
});
