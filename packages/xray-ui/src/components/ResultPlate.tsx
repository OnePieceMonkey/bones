import { cx } from "../cx";
import { resultLabel, safeFormat } from "../model/format";
import type { ResultPlateProps } from "../types";

function resultIcon(result: string): string {
  switch (result) {
    case "approved":
      return "✓";
    case "partially_approved":
      return "◐";
    default:
      return "✕";
  }
}

export function ResultPlate({ trace, anatomy, className }: ResultPlateProps) {
  const format = safeFormat(anatomy);
  return (
    <div className={cx("xr-result", className)} data-result={trace.result} role="status">
      <span className="xr-result-icon" aria-hidden="true">
        {resultIcon(trace.result)}
      </span>
      <span className="xr-result-label">{resultLabel(trace.result)}</span>
      <span className="xr-result-amount">{format("amountCents", trace.amountCents)}</span>
    </div>
  );
}
