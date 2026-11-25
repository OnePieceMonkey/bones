import type { Trace } from "@bones/core";
import type { VersionLabel } from "../rules/catalog";

/** Replays memoized per version label within a session. v1 is the original Trace. */
export type ReplayStore = Readonly<Partial<Record<VersionLabel, Trace>>>;

export const initialReplayStore = (original: Trace): ReplayStore => ({ v1: original });

export const getReplay = (s: ReplayStore, l: VersionLabel): Trace | undefined => s[l];

/** Returns a new store. v1 is the Original_Trace and is never replaced. */
export const putReplay = (s: ReplayStore, l: VersionLabel, t: Trace): ReplayStore =>
  l === "v1" ? s : { ...s, [l]: t };
