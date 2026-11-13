import { cx } from "../cx";
import { animClass, useReducedMotion } from "../hooks/useReducedMotion";
import { crackPath } from "../model/hash";
import { fieldViews, selectBones } from "../model/selectors";
import type { AnswerCardProps } from "../types";

export function AnswerCard({ trace, anatomy, reducedMotion, className }: AnswerCardProps) {
  const reduced = useReducedMotion(reducedMotion);
  const bones = selectBones(trace, anatomy);
  const fields = fieldViews(trace, anatomy, bones);
  const anyOverruled = fields.some((f) => f.overruled);

  // Distinct bone labels, in Anatomy order.
  const overruledLabels: string[] = [];
  if (anyOverruled) {
    const seen = new Set<string>();
    for (const b of bones) {
      if (b.state !== "fractured") continue;
      if (!fields.some((f) => f.overruled && f.overruledBy.includes(b.label))) continue;
      if (seen.has(b.label)) continue;
      seen.add(b.label);
      overruledLabels.push(b.label);
    }
  }

  return (
    <article
      className={cx("xr-answer", anyOverruled && animClass(reduced, "shake"), className)}
      aria-label="AI answer"
      data-overruled={anyOverruled ? "true" : "false"}
    >
      <header className="xr-answer-head">AI answer</header>
      <dl className="xr-answer-fields">
        {fields.map((f) => (
          <div key={f.path} className="xr-field" data-path={f.path} data-overruled={f.overruled ? "true" : "false"}>
            <dt>{f.label}</dt>
            <dd>
              <span className="xr-field-value">{f.value}</span>{" "}
              <span className="xr-conf">confidence {f.confidenceText}</span>
              {f.overruled && <span className="xr-badge">⚠ OVERRULED</span>}
            </dd>
          </div>
        ))}
      </dl>
      {anyOverruled && (
        <>
          <svg className="xr-crack-overlay" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
            <path className="xr-crack-glass" d={crackPath(trace.decisionId, 400, 300)} />
            <path className="xr-crack-line" d={crackPath(trace.decisionId, 400, 300)} />
          </svg>
          <div className={cx("xr-stamp", animClass(reduced, "stamp"))} role="note">
            <span className="xr-stamp-title">OVERRULED BY RULE</span>
            <span className="xr-stamp-bones">{overruledLabels.join(", ")}</span>
          </div>
        </>
      )}
    </article>
  );
}
