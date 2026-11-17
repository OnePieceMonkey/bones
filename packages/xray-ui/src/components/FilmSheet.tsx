import type { CSSProperties } from "react";
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

/** Neutral placeholder strokes drawn over the thumbnail. Decorative only. */
const PAPER_LINES = ["━━━━ ━━ ━━━", "── ──── ───", "━━━ ── ━━━━", "──── ━━"];
const TILTS = [-3, 2, -1];

/** Deterministic tilt in degrees from the title (no randomness). */
function tiltFor(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return TILTS[h % TILTS.length] as number;
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
      <span className="xr-sheet-paper" aria-hidden="true" style={{ "--xr-tilt": `${tiltFor(title)}deg` } as CSSProperties}>
        <AssetImage src={paperUrl} width={90} height={130} className="xr-sheet-thumb" />
        {PAPER_LINES.map((line, i) => (
          <span key={i} className="xr-sheet-line">{line}</span>
        ))}
      </span>
      <span id={`${id}-title`} className="xr-sheet-title">{title}</span>
      <span id={descId} className="xr-sheet-desc">
        {description}
      </span>
    </button>
  );
}
