import { useEffect, useRef, type CSSProperties } from "react";
import { cx } from "../../cx";
import { buildGaugeModel } from "../../model/confidence";
import { needleAngle } from "../../model/gauge";
import { METER, meterPoint, meterTicks, redZoneArc } from "../../model/meterGeometry";
import { needleSwing } from "../../model/needleSwing";
import { selectBones } from "../../model/selectors";
import type { Anatomy, CommonProps, Trace } from "../../types";

export interface MeterProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
}

const LABEL = "AI READ CONFIDENCE";
const VIEW_W = 200;
const VIEW_H = 105;
/** Five major ticks: 0, 25, 50, 75, 100. */
const MAJOR_COUNT = 5;
const MINOR_PER_STEP = 4;
const NUMBER_RADIUS = METER.scaleRadius - METER.tickMajor - 9;
/** Fixed id keeps the markup identical across mounts (render determinism). */
const faceId = "xr-meter-face";
const EMPTY_ANATOMY: Anatomy = { bones: [], fieldLabels: {} };

const f = (v: number): number => Math.round(v * 100) / 100;

/**
 * AI read confidence meter: a rectangular VU meter drawn as inline SVG.
 * Scale 0 to 100; without a confidence the needle rests at the minimum.
 */
export function Meter({ trace, anatomy, className }: MeterProps) {
  const bones = selectBones(trace, anatomy ?? EMPTY_ANATOMY);
  const model = buildGaugeModel(trace, bones);

  // The previous angle starts at the resting position; it updates after commit.
  const prevAngle = useRef(needleAngle(null));
  const swing = needleSwing(prevAngle.current, model.angle);
  useEffect(() => {
    prevAngle.current = model.angle;
  }, [model.angle]);

  const swingStyle = {
    "--from": `${swing.from}deg`,
    "--over": `${swing.over}deg`,
    "--to": `${swing.to}deg`,
  } as CSSProperties;
  const valueProps: { "aria-valuenow"?: number } =
    model.value === null ? {} : { "aria-valuenow": Math.round(100 * model.value) };

  const majors = meterTicks(MAJOR_COUNT);
  const steps = (MAJOR_COUNT - 1) * MINOR_PER_STEP;
  const minors = Array.from({ length: steps + 1 }, (_, i) => i / steps).filter(
    (v) => Math.abs(v * (MAJOR_COUNT - 1) - Math.round(v * (MAJOR_COUNT - 1))) > 1e-9,
  );
  const zone = redZoneArc();
  const { pivot } = METER;

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
      <svg
        className="xr-pmeter-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={faceId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--xr-meter-face-a)" }} />
            <stop offset="1" style={{ stopColor: "var(--xr-meter-face-b)" }} />
          </linearGradient>
        </defs>
        <rect className="xr-pmeter-bezel" x={0} y={0} width={VIEW_W} height={VIEW_H} rx={9} />
        <rect
          className="xr-pmeter-face"
          x={5}
          y={5}
          width={VIEW_W - 10}
          height={VIEW_H - 10}
          rx={5}
          fill={`url(#${faceId})`}
        />
        <path className="xr-pmeter-zone" d={zone.d} fill="none" />
        {minors.map((v) => {
          const a = needleAngle(v);
          const p = meterPoint(a, METER.scaleRadius);
          const q = meterPoint(a, METER.scaleRadius - METER.tickMinor);
          return (
            <line key={v} className="xr-pmeter-tick" x1={f(p.x)} y1={f(p.y)} x2={f(q.x)} y2={f(q.y)} />
          );
        })}
        {majors.map((t) => {
          const q = meterPoint(t.angle, METER.scaleRadius - METER.tickMajor);
          const n = meterPoint(t.angle, NUMBER_RADIUS);
          return (
            <g key={t.value}>
              <line
                className="xr-pmeter-tick xr-pmeter-tick--major"
                x1={f(t.x)}
                y1={f(t.y)}
                x2={f(q.x)}
                y2={f(q.y)}
              />
              <text className="xr-pmeter-num" x={f(n.x)} y={f(n.y)} textAnchor="middle" dominantBaseline="middle">
                {Math.round(t.value * 100)}
              </text>
            </g>
          );
        })}
        <g
          key={String(model.value)}
          className="xr-pmeter-needle"
          style={swingStyle}
          data-angle={model.angle}
          transform={`rotate(${model.angle} ${pivot.x} ${pivot.y})`}
        >
          <line
            className="xr-pmeter-needle-line"
            x1={pivot.x}
            y1={pivot.y}
            x2={pivot.x}
            y2={pivot.y - METER.needle}
          />
        </g>
        <circle className="xr-pmeter-pivot" cx={pivot.x} cy={pivot.y} r={5} />
      </svg>
    </div>
  );
}
