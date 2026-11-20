import type { ReactNode } from "react";
import type { CommonProps } from "../../types";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { motionMode } from "../../model/motion";
import { Lightbox } from "../Lightbox";
import { HeaderBar } from "./HeaderBar";
import { SteelFrame } from "./SteelFrame";

export type IntroPhase = "idle" | "running" | "done";

export interface ShellFrameProps extends CommonProps {
  /** Text of the single visually hidden h1. */
  heading: string;
  /** Header pill text and lightbox view. */
  xray: boolean;
  /** Right-aligned secondary actions in the header. */
  headerActions?: ReactNode;
  /** aria-label of the lightbox. */
  lightboxLabel?: string;
  /** Control panel slot (grid area `ctrl`). */
  controls?: ReactNode;
  /** Lightbox content. */
  children?: ReactNode;
  /** Status text shown in the header, right of the tagline (aria-live polite). */
  statusNote?: ReactNode;
  /** Hidden context text for the header. */
  contextNote?: ReactNode;
  introPhase?: IntroPhase;
  /** Extra class on the lightbox (the fracture shake). */
  lightboxClassName?: string;
}

/**
 * Full-screen composition: hidden h1, header, steel frame and lightbox.
 * Scales with `--xr-u` and scopes reduced motion through `data-motion` and `xr-live`.
 */
export function ShellFrame({
  heading,
  xray,
  headerActions,
  lightboxLabel,
  controls,
  children,
  statusNote,
  contextNote,
  introPhase = "idle",
  lightboxClassName,
  reducedMotion,
  className,
}: ShellFrameProps) {
  const reduced = useReducedMotion(reducedMotion);
  const classes = ["xr-shell", reduced ? "" : "xr-live", className ?? ""].filter(Boolean).join(" ");
  return (
    <div
      className={classes}
      data-motion={motionMode(reducedMotion)}
      data-intro={reduced ? "done" : introPhase}
      data-xray={xray ? "true" : "false"}
    >
      <h1 className="xr-visually-hidden" tabIndex={-1}>
        {heading}
      </h1>
      <HeaderBar
        xray={xray}
        {...(headerActions !== undefined ? { headerActions } : {})}
        {...(statusNote !== undefined ? { statusNote } : {})}
        {...(contextNote !== undefined ? { contextNote } : {})}
      />
      <SteelFrame className="xr-shell-frame">
        <Lightbox
          xray={xray}
          pill={false}
          plate={false}
          {...(lightboxClassName !== undefined ? { className: lightboxClassName } : {})}
          {...(lightboxLabel !== undefined ? { title: lightboxLabel } : {})}
          {...(reducedMotion !== undefined ? { reducedMotion } : {})}
        >
          <span className="xr-cone" aria-hidden="true">
            <span className="xr-cone-flicker" />
          </span>
          {children}
          {controls}
        </Lightbox>
      </SteelFrame>
    </div>
  );
}
