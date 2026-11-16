import { meterUrl } from "../../assets";
import { cx } from "../../cx";
import { buildGaugeModel } from "../../model/confidence";
import { selectBones } from "../../model/selectors";
import type { Anatomy, CommonProps, Trace } from "../../types";
import { AssetImage } from "../shell/AssetImage";
export interface MeterProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
}
const LABEL = "AI READ CONFIDENCE";
const IMG_W = 640;
const IMG_H = 478;
/** Pivot and needle length, in image pixels of `meter.webp` (dial arc centre). */
const PIVOT_X = 320;
const PIVOT_Y = 270;
const NEEDLE_LENGTH = 140;
const EMPTY_ANATOMY: Anatomy = { bones: [], fieldLabels: {} };
/**
 * AI read confidence meter: a dial image with an SVG needle and pivot.
 * Scale 0 to 100; without a confidence the needle rests at the minimum.
 */
export function Meter({ trace, anatomy, className }: MeterProps) {
  const bones = selectBones(trace, anatomy ?? EMPTY_ANATOMY);
  const model = buildGaugeModel(trace, bones);
  const valueProps: { "aria-valuenow"?: number } =
    model.value === null ? {} : { "aria-valuenow": Math.round(100 * model.value) };
  return (
    <div
      className={cx("xr-pmeter", className)}
      role="meter"
      aria-label={LABEL}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={model.value === null ? "no confidence available" : `confidence ${model.text}`}
      {...valueProps}
    >
      <AssetImage className="xr-pmeter-img" src={meterUrl} width={IMG_W} height={IMG_H} />
      <svg
        className="xr-pmeter-svg"
        viewBox={`0 0 ${IMG_W} ${IMG_H}`}
        aria-hidden="true"
        focusable="false"
      >
        <g
          className="xr-pmeter-needle"
          data-angle={model.angle}
          transform={`rotate(${model.angle} ${PIVOT_X} ${PIVOT_Y})`}
        >
          <line
            className="xr-pmeter-needle-line"
            x1={PIVOT_X}
            y1={PIVOT_Y}
            x2={PIVOT_X}
            y2={PIVOT_Y - NEEDLE_LENGTH}
          />
        </g>
        <circle className="xr-pmeter-pivot" cx={PIVOT_X} cy={PIVOT_Y} r={9} />
      </svg>
    </div>
  );
}
