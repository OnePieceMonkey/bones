import { cx } from "../../cx";
import { glassCracksUrl, stampFrameUrl } from "../../assets";
import { useHoveredRule } from "../../hooks/useHoveredRule";
import { summariseValue } from "../../model/format";
import { fieldViews, hasFieldLabel, relatedFields, selectBones } from "../../model/selectors";
import type { AnswerCardProps, GlassCardExtraProps } from "../../types";
import { AssetImage } from "../shell/AssetImage";

export type GlassCardProps = AnswerCardProps & GlassCardExtraProps;

/**
 * Frosted-glass AI answer. Same row markup as AnswerCard. When a field is
 * overruled, the glass shows cracks and exactly one tilted stamp naming the
 * first overruled bone (anatomy order) and its rule version.
 */
export function GlassCard({
  trace,
  anatomy,
  className,
  showUnlabelled = false,
  overruled,
  stampDetail,
}: GlassCardProps) {
  const { hoveredRuleId } = useHoveredRule();
  const bones = selectBones(trace, anatomy);
  const fields = fieldViews(trace, anatomy, bones);
  const fieldOverruled = fields.some((f) => f.overruled);
  const anyOverruled = overruled === true || fieldOverruled;
  const visibleFields = showUnlabelled ? fields : fields.filter((f) => hasFieldLabel(anatomy, f.path));

  const firstOverruled = fieldOverruled
    ? bones.find((b) => b.state === "fractured" && fields.some((f) => f.overruled && f.overruledBy.includes(b.label)))
    : undefined;

  const hovered = hoveredRuleId == null ? undefined : bones.find((b) => b.ruleId === hoveredRuleId);
  const linked = new Set(hovered ? relatedFields(hovered) : []);

  return (
    <article
      className={cx("xr-glass", className)}
      aria-label="AI answer"
      data-overruled={anyOverruled ? "true" : "false"}
    >
      {anyOverruled && <AssetImage className="xr-cracks" src={glassCracksUrl} width={1600} height={893} />}
      <div className="xr-glass-body">
        <header className="xr-answer-head">AI answer</header>
        <dl className="xr-answer-fields">
          {visibleFields.map((f) => (
            <div
              key={f.path}
              className="xr-field"
              data-path={f.path}
              data-overruled={f.overruled ? "true" : "false"}
              {...(linked.has(f.path) ? { "data-linked": "true" } : {})}
            >
              <dt>{f.label}</dt>
              <dd>
                <span className="xr-field-value">{summariseValue(trace.proposedFields[f.path], f.value)}</span>{" "}
                <span className="xr-conf">confidence {f.confidenceText}</span>
                {f.overruled && <span className="xr-badge">⚠ OVERRULED</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {anyOverruled && (
        <div className="xr-stamp xr-glass-stamp" role="note">
          <AssetImage className="xr-stamp-frame" src={stampFrameUrl} width={640} height={362} />
          <span className="xr-stamp-title">OVERRULED BY RULE</span>
          {stampDetail !== undefined && stampDetail !== "" ? (
            <span className="xr-stamp-bones">{stampDetail}</span>
          ) : (
            firstOverruled && (
              <span className="xr-stamp-bones">
                {firstOverruled.label}
                {firstOverruled.version !== null ? ` ${firstOverruled.version}` : ""}
              </span>
            )
          )}
        </div>
      )}
    </article>
  );
}
