import type { Ref } from "react";
import { evidenceRows, stateText } from "../../model/selectors";
import type { Anatomy, BoneView } from "../../types";

export interface RuleBoxProps {
  /** DOM id, `tooltipId(ruleId)`; the hotspot points at it with aria-describedby. */
  id: string;
  bone: BoneView;
  anatomy: Anatomy;
  /** Position in px inside the lightbox. Omitted when it cannot be measured. */
  rect?: { left: number; top: number };
  boxRef?: Ref<HTMLDivElement>;
}

/** Rule label, version, state, message and evidence of one rule. */
export function RuleBox({ id, bone, anatomy, rect, boxRef }: RuleBoxProps) {
  const outcome = bone.outcome;
  const rows = outcome ? evidenceRows(outcome, anatomy) : [];
  return (
    <div
      ref={boxRef}
      role="tooltip"
      id={id}
      className="xr-rulebox"
      data-positioned={rect ? "true" : "false"}
      {...(rect ? { style: { left: `${rect.left}px`, top: `${rect.top}px` } } : {})}
    >
      <p className="xr-rb-head">
        {bone.ruleId} v{bone.version ?? "n/a"}
      </p>
      <p className="xr-rb-state">{stateText(bone)}</p>
      {outcome && <p className="xr-rb-msg">{outcome.renderedMessage}</p>}
      {rows.length > 0 ? (
        <dl className="xr-rb-evidence">
          {rows.map((row, i) => (
            <div key={`${row.path}:${i}`} className="xr-rb-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="xr-rb-empty">No evidence recorded</p>
      )}
    </div>
  );
}

/** Line from the rule box to the hotspot centre, ending in a dot on the bone; covers the lightbox. */
export function RuleBoxLine({ line }: { line: { x1: number; y1: number; x2: number; y2: number } }) {
  return (
    <svg className="xr-rb-line" aria-hidden="true" focusable="false">
      <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} strokeWidth={2} />
      <circle cx={line.x2} cy={line.y2} r={3.5} />
    </svg>
  );
}
