import { knobAngle } from "./gauge";

export interface KnobLabel {
  index: number;
  angleDeg: number;
  x: number;
  y: number;
  active: boolean;
}

export interface KnobTick {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Knob geometry in percent of the knob box (`rootU` css units wide). `dialRadius`
 * is the visible bakelite edge (knob.webp art radius 39.8 % of the dial image,
 * which is 88.4 % of the box). Labels sit on a tight arc just outside it.
 */
export const KNOB = {
  center: 50,
  rootU: 164,
  dialRadius: 35.2,
  labelRadius: 43.5,
  tickInner: 36.6,
  tickOuter: 39,
} as const;
const TICK_INNER = KNOB.tickInner;
const TICK_OUTER = KNOB.tickOuter;
/** Distance from the dial edge to the label centre, in css units (u). */
export const KNOB_LABEL_GAP_U = ((KNOB.labelRadius - KNOB.dialRadius) / 100) * KNOB.rootU;
const r1 = (v: number): number => Math.round(v * 10) / 10;

/** Point on a circle around the knob centre, in percent; 0 degrees points up. */
function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: KNOB.center + radius * Math.sin(rad),
    y: KNOB.center - radius * Math.cos(rad),
  };
}

/** Label positions on the label circle, in percent of the knob box, rounded to 0.1. */
export function knobLabelPositions(count: number, activeIndex: number): KnobLabel[] {
  const labels: KnobLabel[] = [];
  for (let index = 0; index < count; index++) {
    const angleDeg = knobAngle(index, count);
    const p = polar(angleDeg, KNOB.labelRadius);
    labels.push({ index, angleDeg, x: r1(p.x), y: r1(p.y), active: index === activeIndex });
  }
  return labels;
}

/** Short engraved tick lines from the dial edge towards each label, at each detent angle. */
export function knobTicks(count: number): KnobTick[] {
  const ticks: KnobTick[] = [];
  for (let index = 0; index < count; index++) {
    const a = knobAngle(index, count);
    const from = polar(a, TICK_INNER);
    const to = polar(a, TICK_OUTER);
    ticks.push({ x1: r1(from.x), y1: r1(from.y), x2: r1(to.x), y2: r1(to.y) });
  }
  return ticks;
}
