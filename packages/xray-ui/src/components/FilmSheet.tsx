import type { CommonProps } from "../types";
import { cx } from "../cx";
import { paperUrl } from "../assets";
import { AssetImage } from "./shell/AssetImage";

export interface FilmSheetProps extends CommonProps {
  /** Used for the description id. */
  id: string;
  /** At most 60 characters. */
  title: string;
  /** One line, at most 120 characters, no line breaks. */
  description: string;
  disabled?: boolean;
  /** True while this sheet is being loaded: it slides in. */
  selected?: boolean;
  onSelect: () => void;
}

/**
 * A film sheet clipped to the lightbox. One button: the accessible name is the
 * title, the accessible description is the one-line description. It knows no
 * result and no domain text. A disabled sheet never calls `onSelect`.
 */
export function FilmSheet({
  id,
  title,
  description,
  disabled,
  selected,
  onSelect,
  reducedMotion,
  className,
}: FilmSheetProps) {
  const descId = `${id}-desc`;
  return (
    <button
      type="button"
      id={id}
      className={cx("xr-sheet", className)}
      aria-labelledby={`${id}-title`}
      aria-describedby={descId}
      disabled={disabled === true}
      data-selected={selected === true ? "true" : "false"}
      {...(reducedMotion === true ? { "data-reduced": "true" } : {})}
      onClick={onSelect}
    >
      <span className="xr-sheet-clip" aria-hidden="true" />
      <AssetImage src={paperUrl} width={62} height={110} className="xr-sheet-thumb" />
      <span id={`${id}-title`} className="xr-sheet-title">{title}</span>
      <span id={descId} className="xr-sheet-desc">
        {description}
      </span>
    </button>
  );
}
