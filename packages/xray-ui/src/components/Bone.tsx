import { cx } from "../cx";
import { animClass, useReducedMotion } from "../hooks/useReducedMotion";
import { stateText } from "../model/selectors";
import type { BoneButtonProps, BoneGlyphProps, BoneState, Splinter } from "../types";

const ICONS: Record<BoneState, string> = {
  passed: "\u2713",
  "not-applicable": "\u2013",
  fractured: "\u2715",
};

const CRACK_POINTS = "-10,-8 -3,0 -8,4 2,8 6,2 12,8";

/** Icon shown for a bone state (check, dash or cross). */
export function boneIcon(state: BoneState): string {
  return ICONS[state];
}

/** Accessible name: "label, rule id version v, state". */
export function boneAriaLabel(bone: BoneButtonProps["bone"]): string {
  return `${bone.label}, rule ${bone.ruleId} version ${bone.version ?? "n/a"}, ${stateText(bone)}`;
}

/** Small triangle at `length` along `angleDeg`, pointing outwards. */
function splinterPoints(s: Splinter): string {
  const rad = (s.angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const local: Array<[number, number]> = [
    [s.length + s.size, 0],
    [s.length - s.size / 2, -s.size / 2],
    [s.length - s.size / 2, s.size / 2],
  ];
  return local.map(([x, y]) => `${r1(x * cos - y * sin)},${r1(x * sin + y * cos)}`).join(" ");
}

export function BoneGlyph({ bone, reducedMotion, className }: BoneGlyphProps) {
  const reduced = useReducedMotion(reducedMotion);
  const fractured = bone.state === "fractured";
  const glow =
    bone.state === "passed" ? "xr-glow-cyan" : fractured ? "xr-glow-red" : undefined;

  return (
    <g
      className={cx("xr-bone", `xr-bone--${bone.state}`, glow, className)}
      data-rule-id={bone.ruleId}
      data-state={bone.state}
      transform={`translate(${bone.position.x} ${bone.position.y})`}
    >
      {fractured && (
        <circle
          className={cx("xr-pulse-ring", animClass(reduced, "pulse"))}
          r={22}
          fill="none"
        />
      )}
      <rect className="xr-bone-body" x={-24} y={-8} width={48} height={16} rx={8} />
      <circle className="xr-bone-end" cx={-24} cy={0} r={6} />
      <circle className="xr-bone-end" cx={24} cy={0} r={6} />
      {fractured && (
        <>
          <polyline className="xr-crack" points={CRACK_POINTS} fill="none" />
          {bone.splinters.map((s, i) => (
            <polygon key={i} className="xr-splinter" points={splinterPoints(s)} />
          ))}
        </>
      )}
      <text className="xr-bone-icon" textAnchor="middle" dominantBaseline="central" aria-hidden="true">
        {boneIcon(bone.state)}
      </text>
    </g>
  );
}

export function BoneButton({ bone, describedBy, className }: BoneButtonProps) {
  const text = stateText(bone);
  return (
    <button
      type="button"
      className={cx("xr-bone-btn", className)}
      data-rule-id={bone.ruleId}
      data-state={bone.state}
      aria-label={boneAriaLabel(bone)}
      aria-describedby={describedBy}
    >
      <span aria-hidden="true" className="xr-bone-cue">
        {boneIcon(bone.state)}
      </span>
      <span className="xr-bone-state">{text}</span>
    </button>
  );
}
