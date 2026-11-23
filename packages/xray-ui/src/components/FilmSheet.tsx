import type { CSSProperties } from "react";
import type { CommonProps } from "../types";
import { cx } from "../cx";

export interface FilmSheetProps extends CommonProps {
  /** Used for the description id. */
  id: string;
  /** At most 60 characters. */
  title: string;
  /** One line, at most 120 characters, no line breaks. */
  description: string;
  /** Three to five short text lines drawn on the paper thumbnail (mono font). Data from the caller. */
  lines?: string[];
  disabled?: boolean;
  /** True while this sheet is being loaded: it slides in. */
  selected?: boolean;
  onSelect: () => void;
}

/** Deterministic tilt in degrees, -3 to +3 in half-degree steps, from the title (no randomness). */
function tiltFor(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return ((h >>> 3) % 13) * 0.5 - 3;
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
  lines = [],
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
        {lines.slice(0, 5).map((line, i) => (
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
