import type { CommonProps } from "../types";
import { cx } from "../cx";
export interface StartHeadlineProps extends CommonProps {
  /** Large headline (display font). */
  title: string;
  /** One line below the headline (muted body text). */
  subtitle: string;
}
/** Centred headline block at the top of the lightbox. Text comes from the caller. */
export function StartHeadline({ title, subtitle, className }: StartHeadlineProps) {
  return (
    <div className={cx("xr-start-head", className)}>
      <h2 className="xr-start-title">{title}</h2>
      <p className="xr-start-sub">{subtitle}</p>
    </div>
  );
}
