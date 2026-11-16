import type { Point } from "../types";

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Placement {
  side: "left" | "right";
  left: number;
  top: number;
  line: { x1: number; y1: number; x2: number; y2: number };
}

/** Horizontal distance between the hotspot centre and the box, in px. */
export const GAP = 24;

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Places the rule box beside a hotspot. Coordinates are relative to the
 * lightbox top-left; only the lightbox width and height are used.
 * The preferred side is the one with more free horizontal space (right on a
 * tie). If the box plus GAP does not fit there, the other side is used when it
 * fits. If neither fits, the preferred side is kept and the box is clamped.
 * The line runs from the box point nearest to `center` to `center`.
 * Pure: no I/O, no time, no randomness.
 */
export function placeRuleBox(
  lightbox: Rect,
  center: Point,
  box: { width: number; height: number },
): Placement {
  const freeLeft = center.x;
  const freeRight = lightbox.width - center.x;
  const need = box.width + GAP;
  const preferred: "left" | "right" = freeRight >= freeLeft ? "right" : "left";
  const other: "left" | "right" = preferred === "right" ? "left" : "right";
  const fits = (s: "left" | "right"): boolean => (s === "right" ? freeRight : freeLeft) >= need;
  const side = fits(preferred) ? preferred : fits(other) ? other : preferred;

  const rawLeft = side === "right" ? center.x + GAP : center.x - GAP - box.width;
  const left = clamp(rawLeft, 0, lightbox.width - box.width);
  const top = clamp(center.y - box.height / 2, 0, lightbox.height - box.height);

  const x1 = Math.min(Math.max(center.x, left), left + box.width);
  const y1 = Math.min(Math.max(center.y, top), top + box.height);
  return { side, left, top, line: { x1, y1, x2: center.x, y2: center.y } };
}
