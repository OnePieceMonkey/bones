import type { KeyboardEvent } from "react";
import { knobUrl } from "../../assets";
import { cx } from "../../cx";
import { knobAngle, stepVersion } from "../../model/gauge";
import type { CommonProps } from "../../types";
import { AssetImage } from "../shell/AssetImage";

export interface KnobProps extends CommonProps {
  versions: readonly string[];
  value: string;
  onVersionChange: (version: string) => void;
}

const CENTER = 50;
const LABEL_RADIUS = 46;

/** Point on a circle around the knob centre, in percent; 0 degrees points up. */
function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(rad), y: CENTER - radius * Math.cos(rad) };
}

const r1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * Rule version knob: a bakelite image turned to the selected detent, with the
 * version labels as real text on a circle. One tab stop (the slider); each
 * label is also a click target.
 */
export function Knob({ versions, value, onVersionChange, className }: KnobProps) {
  const count = versions.length;
  const index = Math.max(0, versions.indexOf(value));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = stepVersion(versions, value, e.key);
    if (next !== null) {
      e.preventDefault();
      onVersionChange(next);
    }
  };

  return (
    <div
      className={cx("xr-pknob", className)}
      role="slider"
      tabIndex={0}
      aria-label="RULE VERSION"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, count - 1)}
      aria-valuenow={index}
      aria-valuetext={value}
      onKeyDown={onKeyDown}
    >
      <div
        className="xr-pknob-dial"
        data-angle={knobAngle(index, count)}
        style={{ transform: `rotate(${knobAngle(index, count)}deg)` }}
      >
        <AssetImage className="xr-pknob-img" src={knobUrl} width={512} height={512} />
      </div>
      {versions.map((version, i) => {
        const p = polar(knobAngle(i, count), LABEL_RADIUS);
        return (
          <button
            key={version}
            type="button"
            className="xr-pknob-label"
            data-active={i === index}
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
  );
}
