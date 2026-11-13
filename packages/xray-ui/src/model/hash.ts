import type { Splinter } from "../types";

export const SPLINTER_COUNT = 6;
export const CRACK_SEGMENTS = 8;

/** FNV-1a 32-bit hash, result in [0, 2^32). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** One xorshift32 step. A non-zero state never yields 0. */
export function nextRandom(state: number): number {
  let x = state | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function splinters(ruleId: string): Splinter[] {
  let state = hashString(ruleId) || 1;
  const out: Splinter[] = [];
  for (let n = 0; n < SPLINTER_COUNT; n++) {
    state = nextRandom(state);
    const r1 = state;
    state = nextRandom(state);
    const r2 = state;
    state = nextRandom(state);
    const r3 = state;
    out.push({ angleDeg: r1 % 360, length: 10 + (r2 % 15), size: 3 + (r3 % 4) });
  }
  return out;
}

export function crackPath(seed: string, width: number, height: number): string {
  let state = hashString(seed) || 1;
  const next = (): number => {
    state = nextRandom(state);
    return state;
  };

  const main: Array<[number, number]> = [];
  for (let i = 0; i <= CRACK_SEGMENTS; i++) {
    const u = (next() % 1000) / 1000;
    main.push([round1((i * width) / CRACK_SEGMENTS), round1(height * (0.25 + 0.5 * u))]);
  }

  const last = CRACK_SEGMENTS - 1;
  const starts = [Math.min(2 + (next() % 3), last), Math.min(5 + (next() % 2), last)];

  const parts: string[] = [
    "M " + main.map(([x, y]) => `${x} ${y}`).join(" L "),
  ];

  for (const idx of starts) {
    let [x, y] = main[idx] as [number, number];
    const pts: string[] = [`${x} ${y}`];
    for (let k = 0; k < 3; k++) {
      const dx = (((next() % 1001) / 1000) * 2 - 1) * 0.08 * width;
      const dy = (0.05 + ((next() % 1001) / 1000) * 0.15) * height;
      x = round1(clamp(x + dx, 0, width));
      y = round1(clamp(y + dy, 0, height));
      pts.push(`${x} ${y}`);
    }
    parts.push("M " + pts.join(" L "));
  }
  return parts.join(" ");
}
