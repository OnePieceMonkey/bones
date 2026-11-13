import type { BoneView, GaugeModel, Trace } from "../types";
import { needleAngle } from "./gauge";

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Min confidence of evidence keys of fractured bones; otherwise the average
 * of all finite confidences; null when none. Result is clamped to [0, 1].
 */
export function gaugeValue(trace: Trace, bones: readonly BoneView[]): number | null {
  const conf = trace.confidence as Record<string, unknown>;
  const usable = (k: string): boolean => hasOwn(conf, k) && Number.isFinite(conf[k]);

  const values: number[] = [];
  for (const b of bones) {
    if (b.state !== "fractured" || b.outcome === undefined) continue;
    for (const k of Object.keys(b.outcome.evidence)) {
      if (usable(k)) values.push(conf[k] as number);
    }
  }
  if (values.length > 0) return clamp01(Math.min(...values));

  const all = Object.values(conf).filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (all.length === 0) return null;
  return clamp01(all.reduce((s, v) => s + v, 0) / all.length);
}

export function buildGaugeModel(trace: Trace, bones: readonly BoneView[]): GaugeModel {
  const value = gaugeValue(trace, bones);
  return {
    value,
    angle: needleAngle(value),
    text: value === null ? "n/a" : value.toFixed(2),
  };
}
