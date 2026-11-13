import { useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "../cx";
import { useHoveredRule } from "../hooks/useHoveredRule";
import { selectBones } from "../model/selectors";
import { REGION_BOXES, VIEWBOX, chipFor } from "../model/skeletonLayout";
import { REGIONS } from "../types";
import type { Region, SkeletonProps } from "../types";
import { BoneButton, BoneGlyph } from "./Bone";
import { Tooltip, tooltipId } from "./Tooltip";

const pct = (value: number, total: number): string => `${Math.round((value / total) * 10000) / 100}%`;

/** Decorative silhouette for one region, drawn from its box geometry. */
function silhouette(region: Region): ReactNode {
  const b = REGION_BOXES[region];
  const cx0 = b.x + b.width / 2;
  const cy0 = b.y + b.height / 2;
  switch (region) {
    case "skull":
      return <ellipse cx={cx0} cy={cy0} rx={b.width / 2} ry={b.height / 2} />;
    case "pelvis":
      return <ellipse cx={cx0} cy={cy0} rx={b.width / 2} ry={b.height / 2} />;
    case "ribs": {
      const rows = [0.2, 0.5, 0.8];
      const d = rows
        .map((t) => {
          const y = b.y + t * b.height;
          const dip = 14;
          return (
            `M ${cx0} ${y} Q ${b.x} ${y - dip} ${b.x + 4} ${y + dip} ` +
            `M ${cx0} ${y} Q ${b.x + b.width} ${y - dip} ${b.x + b.width - 4} ${y + dip}`
          );
        })
        .join(" ");
      return <path d={d} fill="none" />;
    }
    case "spine": {
      const count = 6;
      const gap = 4;
      const h = (b.height - gap * (count - 1)) / count;
      return (
        <>
          {Array.from({ length: count }, (_, i) => (
            <rect key={i} x={b.x} y={b.y + i * (h + gap)} width={b.width} height={h} rx={6} />
          ))}
        </>
      );
    }
    default: {
      const w = Math.min(b.width, 40);
      return <rect x={cx0 - w / 2} y={b.y} width={w} height={b.height} rx={w / 2} />;
    }
  }
}

export function Skeleton({ trace, anatomy, reducedMotion, className }: SkeletonProps) {
  const bones = selectBones(trace, anatomy);
  const motion = reducedMotion === undefined ? {} : { reducedMotion };
  const { setHoveredRuleId } = useHoveredRule();
  const [tooltipRuleId, setTooltipRuleId] = useState<string | null>(null);
  const [dismissedRuleId, setDismissedRuleId] = useState<string | null>(null);

  const enter = (ruleId: string): void => {
    setTooltipRuleId(ruleId);
    setHoveredRuleId(ruleId);
  };
  const leave = (ruleId: string): void => {
    setTooltipRuleId((cur) => (cur === ruleId ? null : cur));
    setDismissedRuleId((cur) => (cur === ruleId ? null : cur));
    setHoveredRuleId(null);
  };
  const onKeyDown = (ruleId: string) => (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") setDismissedRuleId(ruleId);
  };

  const activeBone =
    tooltipRuleId !== null && tooltipRuleId !== dismissedRuleId
      ? bones.find((b) => b.ruleId === tooltipRuleId)
      : undefined;

  return (
    <div className={cx("xr-skeleton", className)} role="group" aria-label="Decision skeleton">
      <svg
        className="xr-skeleton-svg"
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        aria-hidden="true"
        focusable="false"
      >
        {REGIONS.map((region) => (
          <g key={region} className="xr-region" data-region={region}>
            {silhouette(region)}
          </g>
        ))}
        {bones.map((bone, i) => {
          const chip = chipFor(bone.region);
          const edgeX = chip.side === "left" ? chip.x + chip.width : chip.x;
          const { x, y } = bone.position;
          return (
            <g key={`${bone.ruleId}:${i}`} className="xr-bone-group" data-rule-id={bone.ruleId}>
              <line
                className="xr-leader"
                x1={x}
                y1={y}
                x2={edgeX}
                y2={y}
                strokeDasharray="2 4"
              />
              <rect
                className="xr-chip"
                x={chip.x}
                y={y - chip.height / 2}
                width={chip.width}
                height={chip.height}
                rx={4}
              />
              <text
                className="xr-chip-text"
                x={chip.x + 6}
                y={y}
                dominantBaseline="central"
              >
                {bone.label}
              </text>
              <BoneGlyph bone={bone} {...motion} />
            </g>
          );
        })}
      </svg>
      {bones.map((bone, i) => {
        const open = activeBone !== undefined && activeBone.ruleId === bone.ruleId;
        const style = {
          left: pct(bone.position.x, VIEWBOX.width),
          top: pct(bone.position.y, VIEWBOX.height),
        };
        return (
          <div
            key={`${bone.ruleId}:${i}`}
            className="xr-bone-slot"
            style={style}
            onPointerEnter={() => enter(bone.ruleId)}
            onPointerLeave={() => leave(bone.ruleId)}
            onFocus={() => enter(bone.ruleId)}
            onBlur={() => leave(bone.ruleId)}
            onKeyDown={onKeyDown(bone.ruleId)}
          >
            <BoneButton
              bone={bone}
              {...(open ? { describedBy: tooltipId(bone.ruleId) } : {})}
              {...motion}
            />
            {open && <Tooltip id={tooltipId(bone.ruleId)} bone={bone} anatomy={anatomy} />}
          </div>
        );
      })}
    </div>
  );
}
