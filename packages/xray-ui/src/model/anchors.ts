import type { AnatomyBone, Point, Region } from "../types";

/** Visible vertical range of the skeleton photo, percent of the full image height. */
export const CROP = { top: 3, bottom: 65 } as const;

/** Anchor of each region, percent of the FULL image (x from left, y from top). */
export const ANCHORS: Record<Region, Point> = {
  skull: { x: 50, y: 9 },
  ribs: { x: 57, y: 29 },
  spine: { x: 50, y: 33 },
  pelvis: { x: 56, y: 47 },
  "arm-right": { x: 69, y: 45 },
  "arm-left": { x: 31, y: 45 },
  // Proposed values, to be reviewed on the first screenshot.
  "leg-left": { x: 44, y: 58 },
  "leg-right": { x: 57, y: 58 },
};

/** Second anchor of the spine region. */
export const SPINE_LOWER: Point = { x: 50, y: 42 };

/** Lattice spacing used to find free points for further bones, in percent. */
export const LATTICE_STEP = 4;

/** Minimum distance between two hotspots on at least one axis, in percent. */
export const MIN_SEPARATION = 3;

const X_MIN = 6;
const X_MAX = 94;
const Y_MIN = 6;
const Y_MAX = 62;
const MAX_CANDIDATES = 400;
const SPINE_BASE: Point = { x: 50, y: 37.5 };

type Offset = readonly [number, number];

/** Lattice offsets ring by ring; inside a ring ordered by |i|+|j|, then i, then j. */
function buildOffsets(): Offset[] {
  const out: Offset[] = [];
  for (let r = 0; out.length < MAX_CANDIDATES; r += 1) {
    const ring: Offset[] = [];
    for (let i = -r; i <= r; i += 1) {
      for (let j = -r; j <= r; j += 1) {
        if (Math.max(Math.abs(i), Math.abs(j)) === r) ring.push([i, j]);
      }
    }
    ring.sort(
      (a, b) =>
        Math.abs(a[0]) + Math.abs(a[1]) - (Math.abs(b[0]) + Math.abs(b[1])) ||
        a[0] - b[0] ||
        a[1] - b[1],
    );
    out.push(...ring);
  }
  return out.slice(0, MAX_CANDIDATES);
}

const OFFSETS: readonly Offset[] = buildOffsets();

function conflicts(p: Point, placed: readonly Point[]): boolean {
  return placed.some(
    (q) => Math.abs(p.x - q.x) < MIN_SEPARATION && Math.abs(p.y - q.y) < MIN_SEPARATION,
  );
}

function inside(p: Point): boolean {
  return p.x >= X_MIN && p.x <= X_MAX && p.y >= Y_MIN && p.y <= Y_MAX;
}

/**
 * Place one point per bone. Depends only on the region and the order of the bones;
 * `ruleId` and `label` are ignored.
 */
export function placeBones(
  bones: readonly Pick<AnatomyBone, "ruleId" | "label" | "region">[],
): Point[] {
  const result: (Point | undefined)[] = bones.map(() => undefined);
  const placed: Point[] = [];
  const seen = new Map<Region, number>();

  // Pass 1: reserve anchors.
  bones.forEach((bone, i) => {
    const n = seen.get(bone.region) ?? 0;
    seen.set(bone.region, n + 1);
    let point: Point | undefined;
    if (n === 0) point = ANCHORS[bone.region];
    else if (n === 1 && bone.region === "spine") point = SPINE_LOWER;
    if (point !== undefined) {
      const copy = { x: point.x, y: point.y };
      result[i] = copy;
      placed.push(copy);
    }
  });

  // Pass 2: lattice walk around the region base.
  bones.forEach((bone, i) => {
    if (result[i] !== undefined) return;
    const base = bone.region === "spine" ? SPINE_BASE : ANCHORS[bone.region];
    let chosen: Point | undefined;
    for (const [di, dj] of OFFSETS) {
      const candidate = { x: base.x + di * LATTICE_STEP, y: base.y + dj * LATTICE_STEP };
      if (inside(candidate) && !conflicts(candidate, placed)) {
        chosen = candidate;
        break;
      }
    }
    const point = chosen ?? { x: base.x, y: base.y };
    result[i] = point;
    placed.push(point);
  });

  return result as Point[];
}

/** Convert a point in percent of the full image to percent of the visible crop box. */
export function toCropPercent(p: Point): Point {
  return { x: p.x, y: ((p.y - CROP.top) / (CROP.bottom - CROP.top)) * 100 };
}
