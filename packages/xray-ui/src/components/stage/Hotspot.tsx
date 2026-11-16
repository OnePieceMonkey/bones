import type { CSSProperties, ReactNode } from "react";
import { cx } from "../../cx";
import { fractureBurstUrl, SPLINTER_URLS } from "../../assets";
import { splinters } from "../../model/hash";
import { splinterAssets } from "../../model/splinterAssets";
import type { HotspotState } from "../../model/hotspotState";
import type { BoneView, CommonProps } from "../../types";
import { BoneButton } from "../Bone";
import { AssetImage } from "../shell/AssetImage";

export interface HotspotProps extends CommonProps {
  bone: BoneView;
  /** Position in percent of the visible crop box. */
  place: { xPct: number; yPct: number };
  hotspotState: HotspotState;
  describedBy?: string;
  /** Intro light-up start in ms, exposed as `--xr-t-light`. */
  lightDelayMs?: number;
  /** Remount key of the fracture group; it changes only when the bone becomes fractured. */
  fxKey?: number;
  /** Extra content anchored to the hotspot (the tooltip, until the rule box replaces it). */
  children?: ReactNode;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Extra fly-out distance beyond the splinter length, in --xr-u units. */
const FLY_EXTRA = 20;

/**
 * Fracture effects group: flash, burst image and six splinters. All values are
 * deterministic per rule id. The red ring is drawn by CSS, so the glow stays
 * when an image fails to load.
 */
function FractureFx({ ruleId, fresh, style }: { ruleId: string; fresh: boolean; style: CSSProperties }) {
  const files = splinterAssets(ruleId);
  const shards = splinters(ruleId);
  return (
    <span
      className="xr-fx"
      data-fresh={fresh ? "true" : "false"}
      data-rule-id={ruleId}
      style={style}
      aria-hidden="true"
    >
      <span className="xr-hs-flash" />
      <AssetImage className="xr-burst" src={fractureBurstUrl} width={768} height={768} />
      {shards.map((sh, i) => {
        const rad = (sh.angleDeg * Math.PI) / 180;
        const dist = sh.length + FLY_EXTRA;
        const style = {
          "--dx": r2(Math.cos(rad) * dist),
          "--dy": r2(Math.sin(rad) * dist),
          "--rot": `${sh.angleDeg - 90}deg`,
        } as CSSProperties;
        return (
          <AssetImage
            key={i}
            className="xr-splinter"
            src={SPLINTER_URLS[files[i] ?? 0] as string}
            width={60}
            height={160}
            style={style}
          />
        );
      })}
    </span>
  );
}

/**
 * One anchored hotspot: a ring by state, an optional check, and the focusable
 * BoneButton. State never depends on colour alone: the button keeps its icon,
 * state text and accessible name.
 */
export function Hotspot({
  bone,
  place,
  hotspotState,
  describedBy,
  lightDelayMs,
  fxKey = 0,
  className,
  reducedMotion,
  children,
}: HotspotProps) {
  const style = { left: `${r2(place.xPct)}%`, top: `${r2(place.yPct)}%` } as CSSProperties;
  if (lightDelayMs !== undefined) (style as Record<string, string>)["--xr-t-light"] = `${lightDelayMs}ms`;
  return (
    <>
    <div
      className={cx("xr-hotspot", className)}
      data-state={hotspotState}
      data-rule-id={bone.ruleId}
      style={style}
    >
      <span className={cx("xr-hs-ring", `xr-hs-ring--${hotspotState}`)} aria-hidden="true" />
      {hotspotState === "applied-no-change" && (
        <span className="xr-hs-check" aria-hidden="true">
          {"\u2713"}
        </span>
      )}
      <BoneButton
        bone={bone}
        {...(describedBy !== undefined ? { describedBy } : {})}
        {...(reducedMotion !== undefined ? { reducedMotion } : {})}
      />
      {children}
    </div>
    {/* Sibling of the transformed hotspot: the screen blend of burst and splinters must
        reach the skeleton photo, so no ancestor may form a stacking context. */}
    {hotspotState === "fractured" && (
      <FractureFx key={fxKey} ruleId={bone.ruleId} fresh={fxKey > 0} style={style} />
    )}
    </>
  );
}
