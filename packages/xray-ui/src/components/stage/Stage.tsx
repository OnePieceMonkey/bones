import { useState } from "react";
import type { KeyboardEvent } from "react";
import { useHoveredRule } from "../../hooks/useHoveredRule";
import { placeBones, toCropPercent } from "../../model/anchors";
import { hotspotState } from "../../model/hotspotState";
import { selectBones } from "../../model/selectors";
import type { Anatomy, CommonProps } from "../../types";
import type { Trace } from "@bones/core";
import { Tooltip, tooltipId } from "../Tooltip";
import { Hotspot } from "./Hotspot";
import { SkeletonPhoto } from "./SkeletonPhoto";

export interface StageProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
}

/** Cropped skeleton photo with one anchored hotspot per bone. */
export function Stage({ trace, anatomy, reducedMotion, className }: StageProps) {
  const bones = selectBones(trace, anatomy);
  const placed = placeBones(bones);
  const { setHoveredRuleId } = useHoveredRule();
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [dismissedRuleId, setDismissedRuleId] = useState<string | null>(null);

  const enter = (ruleId: string): void => {
    setActiveRuleId(ruleId);
    setHoveredRuleId(ruleId);
  };
  const leave = (ruleId: string): void => {
    setActiveRuleId((cur) => (cur === ruleId ? null : cur));
    setDismissedRuleId((cur) => (cur === ruleId ? null : cur));
    setHoveredRuleId(null);
  };
  const onKeyDown = (ruleId: string) => (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") setDismissedRuleId(ruleId);
  };

  return (
    <SkeletonPhoto {...(className !== undefined ? { className } : {})}>
      <div className="xr-hotspots" role="group" aria-label="Decision skeleton">
        {bones.map((bone, i) => {
          const point = toCropPercent(placed[i] ?? { x: 50, y: 50 });
          const open = activeRuleId === bone.ruleId && dismissedRuleId !== bone.ruleId;
          return (
            <div
              key={`${bone.ruleId}:${i}`}
              className="xr-hotspot-wrap"
              onPointerEnter={() => enter(bone.ruleId)}
              onPointerLeave={() => leave(bone.ruleId)}
              onFocus={() => enter(bone.ruleId)}
              onBlur={() => leave(bone.ruleId)}
              onKeyDown={onKeyDown(bone.ruleId)}
            >
              <Hotspot
                bone={bone}
                place={{ xPct: point.x, yPct: point.y }}
                hotspotState={hotspotState(bone)}
                {...(open ? { describedBy: tooltipId(bone.ruleId) } : {})}
                {...(reducedMotion !== undefined ? { reducedMotion } : {})}
              >
                {open && <Tooltip id={tooltipId(bone.ruleId)} bone={bone} anatomy={anatomy} />}
              </Hotspot>
            </div>
          );
        })}
      </div>
    </SkeletonPhoto>
  );
}
