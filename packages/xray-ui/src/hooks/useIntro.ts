import { useEffect, useRef, useState } from "react";
import type { IntroPhase } from "../components/shell/ShellFrame";
import type { IntroSchedule } from "../model/introSchedule";

export interface UseIntroOptions {
  /** Identifies the case. The intro plays once per key. */
  introKey: string;
  xray: boolean;
  /** Resolved Reduced_Motion. */
  reduced: boolean;
  schedule: IntroSchedule;
}

interface Stored {
  key: string;
  phase: "running" | "done";
}

/**
 * One-shot intro phase. "running" is derived on the first render with `xray`
 * true for a new key, so the final state never flashes first. With
 * Reduced_Motion the phase is "done" on the first render and no timer runs.
 */
export function useIntro({ introKey, xray, reduced, schedule }: UseIntroOptions): IntroPhase {
  const [stored, setStored] = useState<Stored | null>(null);
  const endRef = useRef(schedule.endMs);
  endRef.current = schedule.endMs;

  const started = stored !== null && stored.key === introKey;
  const phase: IntroPhase = reduced ? "done" : started ? stored.phase : xray ? "running" : "idle";

  useEffect(() => {
    if (reduced || !xray) return;
    setStored((s) => (s !== null && s.key === introKey ? s : { key: introKey, phase: "running" }));
  }, [introKey, xray, reduced]);

  const running = !reduced && started && stored.phase === "running";
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => {
      setStored((s) => (s !== null && s.key === introKey ? { key: introKey, phase: "done" } : s));
    }, endRef.current);
    return () => clearTimeout(id);
  }, [running, introKey]);

  return phase;
}
