import { cx } from "../cx";
import { useHoveredRule } from "../hooks/useHoveredRule";
import { animClass, useReducedMotion } from "../hooks/useReducedMotion";
import { fieldViews, selectBones, sourceMarks } from "../model/selectors";
import type { FilmClipProps, SourceMark } from "../types";

function pct(v: number): string {
  return `${v * 100}%`;
}

function markText(mark: SourceMark): string {
  return `${mark.tag}: ${mark.label}`;
}

export function FilmClip({ trace, anatomy, source, activeRuleId, reducedMotion, className, scanOverruled = false }: FilmClipProps) {
  const reduced = useReducedMotion(reducedMotion);
  const { hoveredRuleId } = useHoveredRule();

  const activeId = activeRuleId ?? hoveredRuleId;
  const bones = selectBones(trace, anatomy);
  const activeBone = activeId == null ? undefined : bones.find((b) => b.ruleId === activeId);
  const marks = sourceMarks(trace, anatomy, activeBone);

  // Paths of overruled fields; only computed when scan lines are requested.
  const overruledPaths = new Set<string>(
    scanOverruled ? fieldViews(trace, anatomy, bones).filter((f) => f.overruled).map((f) => f.path) : [],
  );
  const scan = (path: string) =>
    overruledPaths.has(path) ? <span key={`scan-${path}`} className="xr-scan" data-path={path} aria-hidden="true" /> : null;

  let body: JSX.Element;

  if (source.kind === "text") {
    const lines = source.text.split("\n");
    const lineMarks = new Map<number, SourceMark[]>();
    for (const mark of marks) {
      const loc = mark.location;
      if (loc.kind !== "line") continue;
      const i = loc.lineIndex;
      if (!Number.isInteger(i) || i < 0 || i >= lines.length) continue;
      const list = lineMarks.get(i);
      if (list) list.push(mark);
      else lineMarks.set(i, [mark]);
    }
    body = (
      <pre className="xr-film-text">
        {lines.map((line, i) => {
          const here = lineMarks.get(i);
          const highlighted = here?.some((m) => m.highlighted) ?? false;
          return (
            <span
              key={i}
              className={cx("xr-film-line", here && "xr-mark xr-mark--line", highlighted && animClass(reduced, "mark"))}
              data-line={i}
              data-highlighted={here ? (highlighted ? "true" : "false") : undefined}
            >
              {here ? (
                <span className="xr-mark-text">
                  {line}
                  {here.map((m) => (
                    <span
                      key={m.path}
                      className="xr-mark-tag"
                      data-path={m.path}
                      data-highlighted={m.highlighted ? "true" : "false"}
                    >
                      {markText(m)}
                    </span>
                  ))}
                </span>
              ) : (
                line
              )}
              {here?.map((m) => scan(m.path))}
            </span>
          );
        })}
      </pre>
    );
  } else {
    body = (
      <div className="xr-film-image-wrap" style={{ position: "relative" }}>
        <img
          className="xr-film-image"
          src={source.src}
          alt={source.alt}
          // Intrinsic size is unknown; CSS sets width 100% and height auto, so these only reserve a ratio.
          width={1000}
          height={1000}
          {...(source.alt === "" ? { "aria-hidden": true } : {})}
        />
        {marks.map((m) => {
          const loc = m.location;
          if (loc.kind !== "bbox") return null;
          return (
            <span
              key={m.path}
              className={cx("xr-mark xr-mark--bbox", m.highlighted && animClass(reduced, "mark"))}
              data-path={m.path}
              data-highlighted={m.highlighted ? "true" : "false"}
              style={{ left: pct(loc.x), top: pct(loc.y), width: pct(loc.width), height: pct(loc.height) }}
            >
              <span className="xr-mark-tag">{markText(m)}</span>
              {scan(m.path)}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <figure className={cx("xr-film", className)} aria-label="Source input">
      <span className="xr-clip xr-clip--left" aria-hidden="true" />
      <span className="xr-clip xr-clip--right" aria-hidden="true" />
      {body}
    </figure>
  );
}
