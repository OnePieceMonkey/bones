import { cx } from "../cx";
import { animClass, useReducedMotion } from "../hooks/useReducedMotion";
import { buildEcgModel } from "../model/ecg";
import { selectBones } from "../model/selectors";
import type { EcgLineProps } from "../types";

export function EcgLine({ trace, anatomy, reducedMotion, className }: EcgLineProps) {
  const reduced = useReducedMotion(reducedMotion);
  const model = buildEcgModel(trace, selectBones(trace, anatomy), true);
  const animated = !model.flatline;

  return (
    <div className={cx("xr-ecg", model.flatline && "xr-ecg--flat", className)}>
      <svg
        className={cx("xr-ecg-svg", model.flatline && "xr-ecg-line--flat")}
        viewBox={`0 0 ${model.width} ${model.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className={cx("xr-ecg-line", model.flatline && "xr-ecg-line--flat", animated && animClass(reduced, "ecg-scroll"))}
          d={model.linePath}
          fill="none"
        />
        {model.spikePath !== "" && (
          <path
            className={cx("xr-ecg-spike", animated && animClass(reduced, "ecg-flash"))}
            d={model.spikePath}
            fill="none"
          />
        )}
      </svg>
      {model.flatline && (
        <span className="xr-ecg-label" aria-hidden="true">
          FLATLINE {"\u2715"}
        </span>
      )}
      <span className="xr-visually-hidden">{model.summary}</span>
    </div>
  );
}
