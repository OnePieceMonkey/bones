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

export function ResultPlate({ trace, anatomy, effective, className }: ResultPlateProps) {
  const format = safeFormat(anatomy);
  const shown = effective?.result ?? trace.result;
  return (
    <div
      className={cx("xr-result", className)}
      data-result={trace.result}
      {...(effective === undefined ? {} : { "data-effective": effective.result })}
      role="status"
    >
      <span className="xr-result-icon" aria-hidden="true">
        {resultIcon(shown)}
      </span>
      <span className="xr-result-label">{resultLabel(shown)}</span>
      {effective !== undefined && (
        <span className="xr-result-overruled">overruled by {effective.reviewerName}</span>
      )}
      {effective !== undefined && (
        <span className="xr-result-rules">Rules decided: {resultLabel(trace.result)}</span>
      )}
      {effective !== undefined && <span className="xr-result-amount-label">Amount by rules</span>}
      <span className="xr-result-amount">{format("amountCents", trace.amountCents)}</span>
    </div>
  );
}
