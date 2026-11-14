import { cx } from "../cx";
import type { ControlStripProps } from "../types";
import { GaugeControl } from "./GaugeControl";
import { KnobControl } from "./KnobControl";
import { ToggleSwitch } from "./ToggleSwitch";

/** Presentational only: never evaluates rules and never changes the Trace. */
export function ControlStrip({
  trace,
  anatomy,
  versions,
  value,
  onVersionChange,
  xray,
  onXrayChange,
  reducedMotion,
  className,
}: ControlStripProps) {
  const motion: { reducedMotion?: boolean } = reducedMotion === undefined ? {} : { reducedMotion };
  return (
    <div className={cx("xr-control-strip", className)} role="group" aria-label="Controls">
      <KnobControl
        versions={versions}
        value={value}
        onVersionChange={onVersionChange}
        label="RULE VERSION"
        {...motion}
      />
      <GaugeControl trace={trace} anatomy={anatomy} {...motion} />
      <ToggleSwitch xray={xray} onXrayChange={onXrayChange} {...motion} />
    </div>
  );
}
