import { useEffect, useRef } from "react";
import { cx } from "../../cx";
import type { DocumentPanelProps } from "../../types";
import { FilmClip } from "../FilmClip";

/**
 * The paper strip that hangs on the film, held by two clips. The text (or the
 * image) scrolls inside its own region. Marks follow the hovered rule through
 * FilmClip; overruled fields with a known source location get a red scan line.
 */
export function DocumentPanel({ trace, anatomy, source, reducedMotion, className }: DocumentPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Where the paper still scrolls (small viewports), bring the first overruled row into view once per decision.
  // Only this container moves (never the page), and it jumps instead of animating, so reduced motion needs no branch.
  useEffect(() => {
    const box = scrollRef.current;
    const scan = box?.querySelector<HTMLElement>(".xr-scan");
    if (!box || !scan || box.scrollHeight <= box.clientHeight) return;
    const b = box.getBoundingClientRect();
    const r = scan.getBoundingClientRect();
    const pad = 8;
    if (r.top < b.top + pad) box.scrollTop += r.top - b.top - pad;
    else if (r.bottom > b.bottom - pad) box.scrollTop += r.bottom - b.bottom + pad;
  }, [trace]);
  return (
    <section className={cx("xr-doc", className)} aria-label="Document">
      <div className="xr-doc-paper">
        <div ref={scrollRef} className="xr-doc-scroll" role="region" aria-label="Document content" tabIndex={0}>
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
