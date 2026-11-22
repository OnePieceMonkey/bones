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

/** Start of the line when no bone is fractured: the centre of the model. */
export const ECG_CENTER = 280;

/** Left-most clamped x of the fractured bones, ECG_CENTER when none is fractured. */
export function ecgStartX(bones: readonly BoneView[]): number {
  const xs = bones
    .filter((b) => b.state === "fractured")
    .map((b) => clamp(b.position.x, SPIKE_MIN_X, SPIKE_MAX_X));
  return xs.length === 0 ? ECG_CENTER : Math.min(...xs);
}

function spikeSegmentFrom(x: number, startX: number): string {
  return `M${Math.max(startX, x - 8)},30 L${Math.max(startX, x - 3)},30 L${x},2 L${x + 3},56 L${x + 8},30`;
}

export function ecgPath(
  spikeXs: readonly number[],
  flatline: boolean,
  startX = 0,
): { linePath: string; spikePath: string } {
  if (flatline) {
    return { linePath: `M${startX},${ECG.baseline} L${ECG.width},${ECG.baseline}`, spikePath: "" };
  }
  const parts: string[] = [`M${startX},${ECG.baseline}`];
  for (let x = ECG.beatStart; x <= LAST_BEAT_X; x += ECG.beatGap) {
    if (x - 14 < startX) continue;
    if (spikeXs.some((s) => Math.abs(s - x) <= BEAT_SKIP_DISTANCE)) continue;
    parts.push(`L${x - 14},30`, beatSegment(x));
  }
  parts.push(`L${ECG.width},${ECG.baseline}`);
  return { linePath: parts.join(" "), spikePath: spikeXs.map((x) => spikeSegmentFrom(x, startX)).join(" ") };
}

/** `fullWidth` keeps the line at x = 0 (the stand-alone ECG); the stage band starts at the fracture. */
export function buildEcgModel(trace: Trace, bones: readonly BoneView[], fullWidth = false): EcgModel {
  const flatline = trace.result === "rejected";
  const spikeXs = flatline
    ? []
    : bones
        .filter((b) => b.state === "fractured")
        .map((b) => clamp(b.position.x, SPIKE_MIN_X, SPIKE_MAX_X));
  const startX = fullWidth ? 0 : ecgStartX(bones);
  const { linePath, spikePath } = ecgPath(spikeXs, flatline, startX);
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
    startX,
  };
}
