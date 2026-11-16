import { useRef } from "react";
import { boneKey, newlyFractured } from "../model/fractureDiff";
import type { BoneView } from "../types";

export interface FractureBatches {
  /** Remount key of the fracture group per bone key (`ruleId:index`). Starts at 0. */
  fxKeys: ReadonlyMap<string, number>;
  /** `""` until the first batch after mount, then `xr-shake-a` / `xr-shake-b` alternating per batch. */
  shakeClass: string;
}

interface Memo {
  signature: string;
  fractured: ReadonlySet<string>;
  fxKeys: Map<string, number>;
  batches: number;
  result: FractureBatches;
}

/**
 * Tracks which bones became fractured since the previous distinct state.
 * A newly fractured bone gets its `fxKey` incremented (so its fracture group
 * remounts and the CSS animation restarts); a bone fractured before and after
 * keeps its key. Each non-empty batch flips the lightbox shake class.
 *
 * The result is memoised on the fractured-set signature, so a repeated
 * render (StrictMode, unrelated state change) never counts as a new batch.
 */
export function useFractureBatches(bones: readonly BoneView[]): FractureBatches {
  const memo = useRef<Memo | null>(null);
  const next = new Set<string>();
  for (const b of bones) if (b.state === "fractured") next.add(boneKey(b.ruleId, b.index));
  const signature = [...next].sort().join("|");

  const prev = memo.current;
  if (prev !== null && prev.signature === signature) return prev.result;

  if (prev === null) {
    const result: FractureBatches = { fxKeys: new Map(), shakeClass: "" };
    memo.current = { signature, fractured: next, fxKeys: new Map(), batches: 0, result };
    return result;
  }

  const added = newlyFractured(prev.fractured, next);
  const fxKeys = new Map(prev.fxKeys);
  for (const key of added) fxKeys.set(key, (fxKeys.get(key) ?? 0) + 1);
  const batches = added.length > 0 ? prev.batches + 1 : prev.batches;
  const shakeClass = batches === 0 ? "" : batches % 2 === 1 ? "xr-shake-a" : "xr-shake-b";
  const result: FractureBatches = { fxKeys, shakeClass };
  memo.current = { signature, fractured: next, fxKeys, batches, result };
  return result;
}
