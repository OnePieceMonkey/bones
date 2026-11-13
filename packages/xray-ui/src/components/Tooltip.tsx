import { evidenceRows, stateText } from "../model/selectors";
import type { TooltipProps } from "../types";

/** Replace every character outside [A-Za-z0-9_-] with "_". */
export function slug(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]/g, "_");
}

/** DOM id of the tooltip for a rule; use it for aria-describedby. */
export function tooltipId(ruleId: string): string {
  return `xr-tip-${slug(ruleId)}`;
}

/** Tooltip is flipped to the left of the bone beyond this x (viewBox units). */
export const TOOLTIP_FLIP_X = 280;

export function Tooltip({ id, bone, anatomy }: TooltipProps) {
  const outcome = bone.outcome;
  const rows = outcome ? evidenceRows(outcome, anatomy) : [];
  const side = bone.position.x > TOOLTIP_FLIP_X ? "left" : "right";
  return (
    <div role="tooltip" id={id} className={`xr-tooltip xr-tooltip--${side}`} data-side={side}>
      <p className="xr-tip-head">
        {bone.ruleId} v{bone.version ?? "n/a"}
      </p>
      <p className="xr-tip-state">{stateText(bone)}</p>
      {outcome && <p className="xr-tip-msg">{outcome.renderedMessage}</p>}
      {rows.length > 0 && (
        <dl className="xr-tip-evidence">
          {rows.map((row, i) => (
            <div key={`${row.path}:${i}`} className="xr-tip-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
