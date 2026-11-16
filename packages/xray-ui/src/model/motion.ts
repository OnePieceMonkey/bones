/** How the Shell resolves Reduced_Motion: prop true, prop false, or no prop (follow the media query). */
export type MotionMode = "reduce" | "full" | "auto";

/** Maps the `reducedMotion` prop to the value of `data-motion`. */
export function motionMode(prop: boolean | undefined): MotionMode {
  if (prop === true) return "reduce";
  if (prop === false) return "full";
  return "auto";
}

/** True when motion should be reduced. A boolean prop wins over the media query. */
export function isReduced(prop: boolean | undefined, media: boolean): boolean {
  return prop ?? media;
}
