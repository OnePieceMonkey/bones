export const SWEEP = { min: -60, max: 60 } as const;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Needle angle in degrees; null / non-finite values rest at SWEEP.min. */
export function needleAngle(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return SWEEP.min;
  return SWEEP.min + (SWEEP.max - SWEEP.min) * clamp01(value);
}

/** Knob pointer angle in degrees for detent `index` of `count`. */
export function knobAngle(index: number, count: number): number {
  if (count <= 1) return 0;
  const angle = -120 + (index * 240) / (count - 1);
  return Math.min(120, Math.max(-120, angle));
}

/** Next version for a keyboard key, or null when no change should be made. */
export function stepVersion(
  versions: readonly string[],
  value: string,
  key: string,
): string | null {
  const i = versions.indexOf(value);
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      if (i === -1) return versions[0] ?? null;
      return i + 1 < versions.length ? (versions[i + 1] ?? null) : null;
    case "ArrowLeft":
    case "ArrowDown":
      if (i === -1) return versions[0] ?? null;
      return i > 0 ? (versions[i - 1] ?? null) : null;
    case "Home":
      return versions.length === 0 || i === 0 ? null : (versions[0] ?? null);
    case "End":
      return versions.length === 0 || i === versions.length - 1
        ? null
        : (versions[versions.length - 1] ?? null);
    default:
      return null;
  }
}
