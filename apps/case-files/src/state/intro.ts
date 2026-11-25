import type { IntroPhase } from "@bones/xray-ui";

/**
 * Only what `ShellFrame` needs. X-RAY starts off (D15) and no timer flips it, so the app has no
 * intro state machine: the phase follows the `xray` flag of the session.
 */
export function introPhaseFor(xray: boolean): IntroPhase {
  return xray ? "running" : "idle";
}
