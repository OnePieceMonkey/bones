import { cx } from "../../cx";
import type { Anatomy, CommonProps, Trace } from "../../types";
import { SCREW_ROTATIONS } from "../shell/SteelFrame";
import type { CSSProperties } from "react";
import { Knob } from "./Knob";
import { Meter } from "./Meter";
import { Toggle } from "./Toggle";

export interface ControlPanelProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
  versions: readonly string[];
  value: string;
  onVersionChange: (version: string) => void;
  xray: boolean;
  onXrayChange: (next: boolean) => void;
}

const CORNERS = ["tl", "tr", "bl", "br"] as const;

/**
 * Steel control panel: rule version knob, confidence meter and X-ray switch.
 * Presentational only. Tab order: Knob, then Toggle (the Meter is not interactive).
 */
export function ControlPanel({
  trace,
  anatomy,
  versions,
  value,
  onVersionChange,
  xray,
  onXrayChange,
  className,
}: ControlPanelProps) {
  return (
    <div className={cx("xr-cpanel", className)} role="group" aria-label="Controls">
      {SCREW_ROTATIONS.map((rot, i) => (
        <span
          key={CORNERS[i]}
          className={`xr-screw xr-screw--${CORNERS[i]}`}
          aria-hidden="true"
          style={{ "--xr-screw-rot": `${rot}deg` } as CSSProperties}
        />
      ))}
      <div className="xr-cpanel-item xr-cpanel-item--knob">
        <Knob versions={versions} value={value} onVersionChange={onVersionChange} />
        <span className="xr-cpanel-plaque">RULE VERSION</span>
      </div>
      <div className="xr-cpanel-item xr-cpanel-item--meter">
        <Meter trace={trace} anatomy={anatomy} />
        <span className="xr-cpanel-plaque">AI READ CONFIDENCE</span>
      </div>
      <div className="xr-cpanel-item xr-cpanel-item--toggle">
        <Toggle xray={xray} onXrayChange={onXrayChange} />
        <span className="xr-cpanel-plaque">X-RAY</span>
      </div>
    </div>
  );
}
