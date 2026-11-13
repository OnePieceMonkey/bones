import { useEffect, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

export interface TypewriterOptions {
  /** Optional override; when omitted the media query decides. */
  reducedMotion?: boolean;
  /** Milliseconds per revealed character. Default 24. */
  speedMs?: number;
  /** When false the typing is paused. Default true. */
  enabled?: boolean;
}

export interface TypewriterResult {
  /** The revealed prefix of the text. */
  shown: string;
  /** Alias of `shown`. */
  text: string;
  done: boolean;
}

/** Reveals `text` one character per `speedMs`. Reduced motion returns the full text at once, without timers. */
export function useTypewriter(text: string, opts: TypewriterOptions = {}): TypewriterResult {
  const { speedMs = 24, enabled = true } = opts;
  const reduced = useReducedMotion(opts.reducedMotion);
  // The count is tied to the text it was counted for, so a text change resets it in the same render.
  const [progress, setProgress] = useState<{ text: string; count: number }>({ text, count: 0 });
  const count = progress.text === text ? progress.count : 0;
  const finished = count >= text.length;

  useEffect(() => {
    if (reduced || !enabled || finished) return;
    const id = setTimeout(() => {
      setProgress((p) => {
        const base = p.text === text ? p.count : 0;
        return { text, count: Math.min(base + 1, text.length) };
      });
    }, speedMs);
    return () => clearTimeout(id);
  }, [reduced, enabled, finished, count, text, speedMs]);

  if (reduced) return { shown: text, text, done: true };
  const shown = text.slice(0, count);
  return { shown, text: shown, done: finished };
}
