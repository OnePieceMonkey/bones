import type { BoneView } from "../types";
import { isAppliedNoChange } from "./selectors";

export type HotspotState = "passed" | "applied-no-change" | "fractured" | "not-applicable";

export function hotspotState(bone: Pick<BoneView, "state" | "outcome">): HotspotState {
  if (bone.state === "fractured") return "fractured";
  if (bone.state === "not-applicable") return "not-applicable";
  return bone.outcome !== undefined && isAppliedNoChange(bone.outcome)
    ? "applied-no-change"
    : "passed";
}
