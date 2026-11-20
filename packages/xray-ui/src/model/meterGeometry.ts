import { needleAngle } from "./gauge";

export interface MeterTick {
  /** Scale value 0..1. */
  value: number;
  /** Degrees from vertical, clockwise positive; equals needleAngle(value). */
  angle: number;
  /** Point on the scale radius. */
  x: number;
  y: number;
}

/** Meter geometry in the SVG viewBox `0 0 200 105`. */
export const METER = {
  pivot: { x: 100, y: 98 },
  needle: 70,
  scaleRadius: 76,
  tickMajor: 6,
  tickMinor: 4,
} as const;

export const RED_ZONE = { from: 0.75, to: 1 } as const;

const r3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Point at `radius` from the pivot; 0 degrees points straight up. */
export function meterPoint(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: METER.pivot.x + radius * Math.sin(rad),
    y: METER.pivot.y - radius * Math.cos(rad),
  };
}

/** `majorCount` ticks evenly spaced over values 0..1, on the scale radius. */
export function meterTicks(majorCount: number): MeterTick[] {
  const n = Math.max(2, Math.floor(majorCount));
  const ticks: MeterTick[] = [];
  for (let i = 0; i < n; i++) {
    const value = i / (n - 1);
    const angle = needleAngle(value);
    const p = meterPoint(angle, METER.scaleRadius);
    ticks.push({ value, angle, x: p.x, y: p.y });
  }
  return ticks;
}

/** Red zone arc on the scale radius, from needleAngle(0.75) to needleAngle(1). */
export function redZoneArc(): { startAngle: number; endAngle: number; d: string } {
  const startAngle = needleAngle(RED_ZONE.from);
  const endAngle = needleAngle(RED_ZONE.to);
  const a = meterPoint(startAngle, METER.scaleRadius);
  const b = meterPoint(endAngle, METER.scaleRadius);
  const r = METER.scaleRadius;
  const d = `M ${r3(a.x)} ${r3(a.y)} A ${r} ${r} 0 0 1 ${r3(b.x)} ${r3(b.y)}`;
  return { startAngle, endAngle, d };
}
