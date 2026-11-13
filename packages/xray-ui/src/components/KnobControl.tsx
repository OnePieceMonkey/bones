import type { KeyboardEvent } from "react";
import { cx } from "../cx";
import { animClass, useReducedMotion } from "../hooks/useReducedMotion";
import { knobAngle, stepVersion } from "../model/gauge";
import type { KnobControlProps } from "../types";

const CENTER = 50;
const TICK_INNER = 34;
const TICK_OUTER = 40;
const LABEL_RADIUS = 47;

/** Point on a circle around the dial centre; 0 degrees points up. */
function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(rad), y: CENTER - radius * Math.cos(rad) };
}

const r1 = (v: number): number => Math.round(v * 10) / 10;

export function KnobControl({
  versions,
  value,
  onVersionChange,
  label,
  reducedMotion,
  className,
}: KnobControlProps) {
  const reduced = useReducedMotion(reducedMotion);
  const index = versions.indexOf(value);
  const current = Math.max(0, index);
  const count = versions.length;
  const name = label ?? "Rule version";

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = stepVersion(versions, value, e.key);
    if (next !== null) {
      e.preventDefault();
      onVersionChange(next);
    }
  };

  return (
    <div
      className={cx("xr-knob", className)}
      role="slider"
      tabIndex={0}
      aria-label={name}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, count - 1)}
      aria-valuenow={current}
      aria-valuetext={value}
      onKeyDown={onKeyDown}
    >
      <svg className="xr-knob-dial" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className="xr-knob-body" cx={CENTER} cy={CENTER} r={30} />
        {versions.map((version, i) => {
          const angle = knobAngle(i, count);
          const a = polar(angle, TICK_INNER);
          const b = polar(angle, TICK_OUTER);
          const t = polar(angle, LABEL_RADIUS);
          return (
            <g key={version} className="xr-knob-detent" data-active={i === index}>
              <line
                className="xr-knob-tick"
                x1={r1(a.x)}
                y1={r1(a.y)}
                x2={r1(b.x)}
                y2={r1(b.y)}
              />
              <text
                className="xr-knob-tick-label"
                x={r1(t.x)}
                y={r1(t.y)}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {version}
              </text>
            </g>
          );
        })}
        <g
          className={cx("xr-knob-pointer", animClass(reduced, "knob"))}
          transform={`rotate(${knobAngle(current, count)} ${CENTER} ${CENTER})`}
          data-angle={knobAngle(current, count)}
        >
          <line className="xr-knob-pointer-line" x1={CENTER} y1={CENTER} x2={CENTER} y2={20} />
        </g>
      </svg>
      <div className="xr-knob-hits">
        {versions.map((version, i) => {
          const p = polar(knobAngle(i, count), LABEL_RADIUS);
          return (
            <button
              key={version}
              type="button"
              className="xr-knob-hit"
              tabIndex={-1}
              aria-hidden="true"
              style={{ left: `${r1(p.x)}%`, top: `${r1(p.y)}%` }}
              onClick={() => onVersionChange(version)}
            >
              {version}
            </button>
          );
        })}
      </div>
      <span className="xr-knob-caption" aria-hidden="true">
        {name}
      </span>
    </div>
  );
}
