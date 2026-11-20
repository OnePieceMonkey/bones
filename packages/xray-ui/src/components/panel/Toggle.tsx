import { toggleUrl } from "../../assets";
import { cx } from "../../cx";
import { AssetImage } from "../shell/AssetImage";
import { Lamp } from "./Lamp";
export interface ToggleProps {
  xray: boolean;
  onXrayChange: (next: boolean) => void;
  className?: string;
}
const SIZE = 256;
/** X-ray switch: an amber lamp above a chrome lever (flipped when on). */
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
        <AssetImage className="xr-ptoggle-img" src={toggleUrl} width={SIZE} height={SIZE} />
      </span>
    </button>
  );
}
