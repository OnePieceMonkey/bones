import type { Ref } from "react";
import { cx } from "../../cx";
import { resultLabel, safeFormat } from "../../model/format";
import { progressShare, resultLine } from "../../model/progress";
import type { Anatomy, CommonProps, EffectiveResult, Trace } from "../../types";

export interface ResultFooterProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
  claimedCents: number;
  effective?: EffectiveResult;
  onReplay?: () => void;
  onOverride?: () => void;
  overrideRef?: Ref<HTMLButtonElement>;
}

/**
 * Footer of the doctor panel: result line, progress bar (approved share of the
 * amount asked for) and the two action buttons.
 */
export function ResultFooter({
  trace,
  anatomy,
  claimedCents,
  effective,
  onReplay,
  onOverride,
  overrideRef,
  className,
}: ResultFooterProps) {
  const format = safeFormat(anatomy);
  const shown = effective?.result ?? trace.result;
  const share = progressShare(trace.amountCents, claimedCents);
  return (
    <div
      className={cx("xr-result", "xr-result-footer", className)}
      data-result={trace.result}
      {...(effective === undefined ? {} : { "data-effective": effective.result })}
      role="status"
    >
      <span className="xr-result-line">{resultLine(shown, trace.amountCents, format)}</span>
      {effective !== undefined && (
        <span className="xr-result-overruled">overruled by {effective.reviewerName}</span>
      )}
      {effective !== undefined && (
        <span className="xr-result-rules">Rules decided: {resultLabel(trace.result)}</span>
      )}
      <div
        className="xr-progress"
        role="progressbar"
        aria-label="Approved share of the amount asked for"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(100 * share)}
      >
        <div className="xr-progress-fill" style={{ transform: `scaleX(${share})` }} />
      </div>
      <div className="xr-result-actions">
        <button type="button" className="xr-footer-btn" onClick={() => onReplay?.()}>
          Replay decision
        </button>
        <button type="button" className="xr-footer-btn" ref={overrideRef} onClick={() => onOverride?.()}>
          Human override
        </button>
      </div>
    </div>
  );
}
