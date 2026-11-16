import type { ReactNode } from "react";
import { cx } from "../../cx";
import type { HotspotState } from "../../model/hotspotState";
import type { BoneView, CommonProps } from "../../types";
import { BoneButton } from "../Bone";

export interface HotspotProps extends CommonProps {
  bone: BoneView;
  /** Position in percent of the visible crop box. */
  place: { xPct: number; yPct: number };
  hotspotState: HotspotState;
  describedBy?: string;
  /** Extra content anchored to the hotspot (the tooltip, until the rule box replaces it). */
  children?: ReactNode;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * One anchored hotspot: a ring by state, an optional check, and the focusable
 * BoneButton. State never depends on colour alone: the button keeps its icon,
 * state text and accessible name.
 */
export function Hotspot({ bone, place, hotspotState, describedBy, className, reducedMotion, children }: HotspotProps) {
  return (
    <div
      className={cx("xr-hotspot", className)}
      data-state={hotspotState}
      data-rule-id={bone.ruleId}
      style={{ left: `${r2(place.xPct)}%`, top: `${r2(place.yPct)}%` }}
    >
      <span className={cx("xr-hs-ring", `xr-hs-ring--${hotspotState}`)} aria-hidden="true" />
      {hotspotState === "applied-no-change" && (
        <span className="xr-hs-check" aria-hidden="true">
          {"\u2713"}
        </span>
      )}
      <BoneButton
        bone={bone}
        {...(describedBy !== undefined ? { describedBy } : {})}
        {...(reducedMotion !== undefined ? { reducedMotion } : {})}
      />
      {children}
    </div>
  );
}
