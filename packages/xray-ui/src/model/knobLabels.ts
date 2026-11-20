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

export const KNOB = { center: 50, labelRadius: 46 } as const;

const TICK_INNER = 40.5;
const TICK_OUTER = 44;

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

/** Short tick lines (radius 40.5 to 44 percent) at each detent angle. */
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
