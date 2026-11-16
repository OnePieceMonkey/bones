import type { CSSProperties, ReactNode } from "react";

/** Fixed, distinct screw rotations in degrees (not random). */
export const SCREW_ROTATIONS = [12, 97, 188, 271] as const;

const CORNERS = ["tl", "tr", "bl", "br"] as const;

export interface SteelFrameProps {
  className?: string;
  children?: ReactNode;
}

/** Brushed-steel frame with an inner bevel and four decorative screws. */
export function SteelFrame({ className, children }: SteelFrameProps) {
  return (
    <div className={className ? `xr-steel ${className}` : "xr-steel"}>
      {SCREW_ROTATIONS.map((rot, i) => (
        <span
          key={CORNERS[i]}
          className={`xr-screw xr-screw--${CORNERS[i]}`}
          aria-hidden="true"
          style={{ "--xr-screw-rot": `${rot}deg` } as CSSProperties}
        />
      ))}
      {children}
    </div>
  );
}
