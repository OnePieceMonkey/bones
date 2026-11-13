import type { Point, Region } from "../types";

/** Skeleton coordinate space (SVG viewBox `0 0 560 900`). */
export const VIEWBOX = { width: 560, height: 900 } as const;

export interface RegionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Axis along which bones of this region are spread. */
  axis: "x" | "y";
  anchor: Point;
}

export const REGION_BOXES: Record<Region, RegionBox> = {
  skull: { x: 230, y: 20, width: 100, height: 110, axis: "x", anchor: { x: 280, y: 75 } },
  ribs: { x: 220, y: 150, width: 120, height: 150, axis: "y", anchor: { x: 280, y: 225 } },
  spine: { x: 265, y: 300, width: 30, height: 170, axis: "y", anchor: { x: 280, y: 385 } },
  pelvis: { x: 220, y: 470, width: 120, height: 90, axis: "x", anchor: { x: 280, y: 515 } },
  "arm-left": { x: 120, y: 160, width: 90, height: 330, axis: "y", anchor: { x: 165, y: 325 } },
  "arm-right": { x: 350, y: 160, width: 90, height: 330, axis: "y", anchor: { x: 395, y: 325 } },
  "leg-left": { x: 210, y: 570, width: 65, height: 310, axis: "y", anchor: { x: 242, y: 725 } },
  "leg-right": { x: 285, y: 570, width: 65, height: 310, axis: "y", anchor: { x: 318, y: 725 } },
};

const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Position of the bone `indexInRegion` (0-based) among `countInRegion` bones of a region.
 * Bones are spread evenly along the region axis and stay strictly inside the box.
 */
export function layoutBone(region: Region, indexInRegion: number, countInRegion: number): Point {
  const box = REGION_BOXES[region];
  const n = Math.max(1, countInRegion);
  const step = indexInRegion + 1;
  if (box.axis === "y") {
    return { x: round2(box.anchor.x), y: round2(box.y + (step * box.height) / (n + 1)) };
  }
  return { x: round2(box.x + (step * box.width) / (n + 1)), y: round2(box.anchor.y) };
}

/** Label chip geometry for a region. */
export function chipFor(region: Region): {
  side: "left" | "right";
  x: number;
  width: number;
  height: number;
} {
  const left = region === "arm-left" || region === "leg-left";
  return { side: left ? "left" : "right", x: left ? 10 : 430, width: 120, height: 22 };
}
