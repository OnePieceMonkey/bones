import { cx } from "../cx";
import { animClass, useReducedMotion } from "../hooks/useReducedMotion";
import { buildGaugeModel } from "../model/confidence";
import { SWEEP } from "../model/gauge";
import { selectBones } from "../model/selectors";
import type { GaugeControlProps } from "../types";

const PIVOT_X = 50;
const PIVOT_Y = 55;
const ARC_RADIUS = 40;
const NEEDLE_LENGTH = 34;

/** Point on the dial arc; 0 degrees points up. */
function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: PIVOT_X + radius * Math.sin(rad), y: PIVOT_Y - radius * Math.cos(rad) };
}

const r1 = (v: number): number => Math.round(v * 10) / 10;

const EMPTY_ANATOMY = { bones: [], fieldLabels: {} };

const LABEL = "AI READ CONFIDENCE";

export function GaugeControl({ trace, anatomy, reducedMotion, className }: GaugeControlProps) {
  const reduced = useReducedMotion(reducedMotion);
  const bones = selectBones(trace, anatomy ?? EMPTY_ANATOMY);
  const model = buildGaugeModel(trace, bones);

  const start = polar(SWEEP.min, ARC_RADIUS);
  const end = polar(SWEEP.max, ARC_RADIUS);
  const arc = `M ${r1(start.x)} ${r1(start.y)} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${r1(end.x)} ${r1(end.y)}`;

  const meterProps: { "aria-valuenow"?: number } =
    model.value === null ? {} : { "aria-valuenow": model.value };

  return (
    <div
      className={cx("xr-gauge", className)}
      role="meter"
      aria-label={LABEL}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuetext={model.text}
      {...meterProps}
    >
      <svg className="xr-gauge-dial" viewBox="0 0 100 60" aria-hidden="true" focusable="false">
        <path className="xr-gauge-arc" d={arc} fill="none" />
        <g
          className={cx("xr-gauge-needle", animClass(reduced, "needle"))}
          transform={`rotate(${model.angle} ${PIVOT_X} ${PIVOT_Y})`}
          data-angle={model.angle}
        >
          <line
            className="xr-gauge-needle-line"
            x1={PIVOT_X}
            y1={PIVOT_Y}
            x2={PIVOT_X}
            y2={PIVOT_Y - NEEDLE_LENGTH}
          />
        </g>
        <circle className="xr-gauge-hub" cx={PIVOT_X} cy={PIVOT_Y} r={3} />
      </svg>
      <span className="xr-gauge-value">{model.text}</span>
      <span className="xr-gauge-caption" aria-hidden="true">
        {LABEL}
      </span>
    </div>
  );
}
