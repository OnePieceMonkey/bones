export interface Swing {
  from: number;
  over: number;
  to: number;
}

const OVERSHOOT_SHARE = 0.1;
const OVERSHOOT_MIN = 1;
const OVERSHOOT_MAX = 8;

/**
 * Keyframe angles for a needle move. The needle starts at `from`, swings past
 * `to` by 10 % of the travel (clamped to 1..8 degrees) and settles on `to`.
 * When `from === to` there is no travel and `over === to`.
 * Pure: no I/O, no time, no randomness.
 */
export function needleSwing(prevAngle: number, nextAngle: number): Swing {
  const travel = nextAngle - prevAngle;
  if (travel === 0) return { from: prevAngle, over: nextAngle, to: nextAngle };
  const overshoot = Math.min(
    OVERSHOOT_MAX,
    Math.max(OVERSHOOT_MIN, Math.abs(travel) * OVERSHOOT_SHARE),
  );
  return {
    from: prevAngle,
    over: nextAngle + Math.sign(travel) * overshoot,
    to: nextAngle,
  };
}
