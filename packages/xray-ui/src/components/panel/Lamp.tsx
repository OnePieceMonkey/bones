import { lampUrl } from "../../assets";
import { cx } from "../../cx";
import { AssetImage } from "../shell/AssetImage";
export interface LampProps {
  lit: boolean;
  className?: string;
}
const SIZE = 256;
/** Amber indicator lamp. Decorative: the switch next to it announces the state. */
export function Lamp({ lit, className }: LampProps) {
  return (
    <span
      className={cx("xr-plamp", className)}
      data-lit={lit ? "true" : "false"}
      aria-hidden="true"
    >
      <AssetImage className="xr-plamp-img" src={lampUrl} width={SIZE} height={SIZE} />
    </span>
  );
}
