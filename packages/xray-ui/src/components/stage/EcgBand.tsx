import type { Trace } from "@bones/core";
import { cx } from "../../cx";
import { animClass, useReducedMotion } from "../../hooks/useReducedMotion";
import { buildEcgModel, ECG } from "../../model/ecg";
import { selectBones } from "../../model/selectors";
import type { Anatomy, CommonProps, Point } from "../../types";
export interface EcgBandProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
  /** One point per bone, in percent of the crop box (same order as the bones). */
  anchors: Point[];
}
/**
 * ECG line across the stage. Spike x positions are the hotspot x percentages
 * mapped onto the ECG width, so each spike sits above its hotspot.
 */
export function EcgBand({ trace, anatomy, anchors, reducedMotion, className }: EcgBandProps) {
  const reduced = useReducedMotion(reducedMotion);
  const bones = selectBones(trace, anatomy).map((b, i) => ({
    ...b,
    position: { ...b.position, x: ((anchors[i]?.x ?? 50) / 100) * ECG.width },
  }));
  const model = buildEcgModel(trace, bones);
  const moving = !model.flatline && !reduced;
  return (
    <div className={cx("xr-ecg-band", model.flatline && "xr-ecg-band--flat", className)}>
      <svg
        className="xr-ecg-band-svg"
        viewBox={`0 0 ${model.width} ${model.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path className={cx("xr-ecg-line", model.flatline && "xr-ecg-line--flat")} d={model.linePath} fill="none" />
        {model.spikePath !== "" && (
          <path
            className={cx("xr-ecg-spike", !reduced && animClass(reduced, "ecg-flash"))}
            d={model.spikePath}
            fill="none"
          />
        )}
      </svg>
      <span
        className={cx("xr-ecg-head", moving ? animClass(reduced, "ecg-head") : "xr-ecg-head--still")}
        aria-hidden="true"
      />
      <span className="xr-visually-hidden">{model.summary}</span>
    </div>
  );
}
