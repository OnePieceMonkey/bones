import { cx } from "../../cx";
import type { DocumentPanelProps } from "../../types";
import { FilmClip } from "../FilmClip";

/**
 * The paper strip that hangs on the film, held by two clips. The text (or the
 * image) scrolls inside its own region. Marks follow the hovered rule through
 * FilmClip; overruled fields with a known source location get a red scan line.
 */
export function DocumentPanel({ trace, anatomy, source, reducedMotion, className }: DocumentPanelProps) {
  return (
    <section className={cx("xr-doc", className)} aria-label="Document">
      <div className="xr-doc-paper">
        <div className="xr-doc-scroll" role="region" aria-label="Document content" tabIndex={0}>
          <FilmClip
            trace={trace}
            anatomy={anatomy}
            source={source}
            scanOverruled
            {...(reducedMotion !== undefined ? { reducedMotion } : {})}
          />
        </div>
      </div>
    </section>
  );
}
