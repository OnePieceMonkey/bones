import { cx } from "../cx";
import type { ToggleSwitchProps } from "../types";

export function ToggleSwitch({ xray, onXrayChange, className }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={xray}
      className={cx("xr-toggle", className)}
      onClick={() => onXrayChange(!xray)}
    >
      <span className="xr-toggle-lamp" data-lit={xray ? "true" : "false"} aria-hidden="true" />
      <span className="xr-toggle-label">X-RAY</span>
      <span className="xr-toggle-state">{xray ? "ON" : "OFF"}</span>
    </button>
  );
}
