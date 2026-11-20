import type { KeyboardEvent } from "react";
import { knobUrl } from "../../assets";
import { cx } from "../../cx";
import { knobAngle, stepVersion } from "../../model/gauge";
import { knobLabelPositions, knobTicks } from "../../model/knobLabels";
import type { CommonProps } from "../../types";
import { AssetImage } from "../shell/AssetImage";

export interface KnobProps extends CommonProps {
  versions: readonly string[];
  value: string;
  onVersionChange: (version: string) => void;
}

/**
 * Rule version knob: a bakelite image turned to the selected detent, with the
 * version labels as real text on a circle. One tab stop (the slider); each
 * label is also a click target.
 */
export function Knob({ versions, value, onVersionChange, className }: KnobProps) {
  const count = versions.length;
  const index = Math.max(0, versions.indexOf(value));
  const labels = knobLabelPositions(count, index);

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
      <svg
        className="xr-pknob-ticks"
        viewBox="0 0 100 100"
        aria-hidden="true"
        focusable="false"
      >
        {knobTicks(count).map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
        ))}
      </svg>
      {labels.map((p, i) => {
        const version = versions[i] as string;
        return (
          <button
            key={version}
            data-index={i}
            type="button"
            className="xr-pknob-label"
            data-active={p.active}
            tabIndex={-1}
            aria-hidden="true"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            onClick={() => onVersionChange(version)}
          >
            {version}
          </button>
        );
      })}
    </div>
  );
}
