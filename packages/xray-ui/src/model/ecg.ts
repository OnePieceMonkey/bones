import type { Trace } from "@bones/core";
import type { BoneView, EcgModel } from "../types";

export const ECG = { width: 560, height: 60, baseline: 30, beatStart: 40, beatGap: 80 } as const;

const SPIKE_MIN_X = 12;
const SPIKE_MAX_X = 548;
const BEAT_SKIP_DISTANCE = 14;
const LAST_BEAT_X = 520;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function beatSegment(x: number): string {
  return (
    `L${x - 10},30 L${x - 6},26 L${x - 3},30 L${x - 2},38 L${x},12 ` +
    `L${x + 2},44 L${x + 4},30 L${x + 10},28 L${x + 14},30`
  );
}

function spikeSegment(x: number): string {
  return `M${x - 8},30 L${x - 3},30 L${x},2 L${x + 3},56 L${x + 8},30`;
}

export function ecgPath(
  spikeXs: readonly number[],
  flatline: boolean,
): { linePath: string; spikePath: string } {
  if (flatline) {
    return { linePath: `M0,${ECG.baseline} L${ECG.width},${ECG.baseline}`, spikePath: "" };
  }
  const parts: string[] = [`M0,${ECG.baseline}`];
  for (let x = ECG.beatStart; x <= LAST_BEAT_X; x += ECG.beatGap) {
    if (spikeXs.some((s) => Math.abs(s - x) <= BEAT_SKIP_DISTANCE)) continue;
    parts.push(`L${x - 14},30`, beatSegment(x));
  }
  parts.push(`L${ECG.width},${ECG.baseline}`);
  return { linePath: parts.join(" "), spikePath: spikeXs.map(spikeSegment).join(" ") };
}

export function buildEcgModel(trace: Trace, bones: readonly BoneView[]): EcgModel {
  const flatline = trace.result === "rejected";
  const spikeXs = flatline
    ? []
    : bones
        .filter((b) => b.state === "fractured")
        .map((b) => clamp(b.position.x, SPIKE_MIN_X, SPIKE_MAX_X));
  const { linePath, spikePath } = ecgPath(spikeXs, flatline);
  const summary = flatline
    ? "flatline"
    : `${spikeXs.length} spike${spikeXs.length === 1 ? "" : "s"}`;
  return {
    width: ECG.width,
    height: ECG.height,
    baseline: ECG.baseline,
    linePath,
    spikePath,
    spikeXs,
    flatline,
    summary,
  };
}
