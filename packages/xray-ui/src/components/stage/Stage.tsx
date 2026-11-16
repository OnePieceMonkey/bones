import { useState } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useElementRect } from "../../hooks/useElementRect";
import { useHoveredRule } from "../../hooks/useHoveredRule";
import { placeBones, toCropPercent } from "../../model/anchors";
import { boneKey } from "../../model/fractureDiff";
import { hotspotState } from "../../model/hotspotState";
import { introPlan } from "../../model/introOrder";
import { placeRuleBox } from "../../model/ruleBoxPlacement";
import { selectBones } from "../../model/selectors";
import type { Anatomy, BoneView, CommonProps } from "../../types";
import type { Trace } from "@bones/core";
import { tooltipId } from "../Tooltip";
import { EcgBand } from "./EcgBand";
import { Hotspot } from "./Hotspot";
import { RuleBox, RuleBoxLine } from "./RuleBox";
import { SkeletonPhoto } from "./SkeletonPhoto";

export interface StageProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
  /** Fracture group remount keys per bone key (`ruleId:index`), from `useFractureBatches`. */
  fxKeys?: ReadonlyMap<string, number>;
}

interface LayerProps {
  bone: BoneView;
  anatomy: Anatomy;
  /** Element that contains the hotspots. */
  root: HTMLElement;
  lightbox: HTMLElement | null;
}

/**
 * Rule box and its line. Positions come from measured rectangles; when the
 * lightbox or the hotspot has no size (jsdom, hidden tab), the box renders
 * without position and without the line.
 */
function RuleBoxLayer({ bone, anatomy, root, lightbox }: LayerProps) {
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null);
  const spot = root.querySelector<HTMLElement>(`.xr-hotspot[data-rule-id="${CSS.escape(bone.ruleId)}"]`);
  const lb = useElementRect(lightbox);
  const hs = useElementRect(spot);
  const box = useElementRect(boxEl);

  let placed: ReturnType<typeof placeRuleBox> | null = null;
  if (lb.width > 0 && lb.height > 0 && hs.width > 0 && hs.height > 0) {
    placed = placeRuleBox(
      lb,
      { x: hs.left - lb.left + hs.width / 2, y: hs.top - lb.top + hs.height / 2 },
      { width: box.width, height: box.height },
    );
  }

  const content = (
    <div className="xr-rb-layer" data-placed={placed ? "true" : "false"}>
      {placed && <RuleBoxLine line={placed.line} />}
      <RuleBox
        id={tooltipId(bone.ruleId)}
        bone={bone}
        anatomy={anatomy}
        boxRef={setBoxEl}
        {...(placed ? { rect: { left: placed.left, top: placed.top } } : {})}
      />
    </div>
  );
  return lightbox ? createPortal(content, lightbox) : content;
}

/** Cropped skeleton photo with one anchored hotspot per bone. */
export function Stage({ trace, anatomy, fxKeys, reducedMotion, className }: StageProps) {
  const bones = selectBones(trace, anatomy);
  const placed = placeBones(bones);
  const { startOf } = introPlan(bones, trace);
  const { setHoveredRuleId } = useHoveredRule();
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [dismissedRuleId, setDismissedRuleId] = useState<string | null>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

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
    if (e.key === "Escape") {
      setDismissedRuleId(ruleId);
      setHoveredRuleId(null);
    }
  };

  const cropPoints = placed.map(toCropPercent);
  const openBone = bones.find((b) => b.ruleId === activeRuleId && dismissedRuleId !== b.ruleId);

  return (
    <SkeletonPhoto {...(className !== undefined ? { className } : {})}>
      <div ref={setRoot} className="xr-hotspots" role="group" aria-label="Decision skeleton">
        {bones.map((bone, i) => {
          const point = toCropPercent(placed[i] ?? { x: 50, y: 50 });
          const open = openBone === bone;
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
                lightDelayMs={startOf.get(bone) ?? 0}
                fxKey={fxKeys?.get(boneKey(bone.ruleId, bone.index)) ?? 0}
                {...(open ? { describedBy: tooltipId(bone.ruleId) } : {})}
                {...(reducedMotion !== undefined ? { reducedMotion } : {})}
              />
            </div>
          );
        })}
        {openBone && root && (
          <RuleBoxLayer
            bone={openBone}
            anatomy={anatomy}
            root={root}
            lightbox={root.closest<HTMLElement>(".xr-viewport")}
          />
        )}
      </div>
      <EcgBand
        trace={trace}
        anatomy={anatomy}
        anchors={cropPoints}
        {...(reducedMotion !== undefined ? { reducedMotion } : {})}
      />
    </SkeletonPhoto>
  );
}
