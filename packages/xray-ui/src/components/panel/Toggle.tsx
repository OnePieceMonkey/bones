import { cx } from "../../cx";
import { Lamp } from "./Lamp";
export interface ToggleProps {
  xray: boolean;
  onXrayChange: (next: boolean) => void;
  className?: string;
}
/** Fixed ids keep the markup identical across mounts (render determinism). */
const ARM_ID = "xr-toggle-arm";
const BALL_ID = "xr-toggle-ball";
/**
 * X-ray switch: an amber lamp above a silver metal toggle (chrome base plate and
 * a tapered lever with a ball tip). The lever points up when on and down when off.
 */
export function Toggle({ xray, onXrayChange, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={xray}
      aria-label="X-RAY"
      className={cx("xr-ptoggle", className)}
      onClick={() => onXrayChange(!xray)}
    >
      <Lamp lit={xray} />
      <span className="xr-ptoggle-lever" data-on={xray ? "true" : "false"} aria-hidden="true">
        <span className="xr-ptoggle-base" />
        <svg className="xr-ptoggle-svg" viewBox="0 0 100 100" focusable="false">
          <defs>
            <linearGradient id={ARM_ID} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#7f8a92" />
              <stop offset="0.35" stopColor="#f4f7f9" />
              <stop offset="0.7" stopColor="#b6c0c7" />
              <stop offset="1" stopColor="#5f6a72" />
            </linearGradient>
            <radialGradient id={BALL_ID} cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.45" stopColor="#c3ccd2" />
              <stop offset="1" stopColor="#4f5a62" />
            </radialGradient>
          </defs>
          <g className="xr-ptoggle-arm">
            <polygon className="xr-ptoggle-arm-shape" points="43,50 57,50 53.5,17 46.5,17" fill={`url(#${ARM_ID})`} />
            <circle className="xr-ptoggle-ball" cx={50} cy={13} r={9} fill={`url(#${BALL_ID})`} />
          </g>
        </svg>
      </span>
    </button>
  );
}
