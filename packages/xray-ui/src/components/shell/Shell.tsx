import type { ReactNode, Ref } from "react";
import { HoveredRuleProvider } from "../../hooks/useHoveredRule";
import type { Anatomy, CommonProps, EffectiveResult, FilmSource, Trace } from "../../types";
import { ControlPanel } from "../panel/ControlPanel";
import { DoctorPanel } from "../panels/DoctorPanel";
import { DocumentPanel } from "../panels/DocumentPanel";
import { GlassCard } from "../panels/GlassCard";
import { Stage } from "../stage/Stage";
import { ShellFrame } from "./ShellFrame";
import type { IntroPhase } from "./ShellFrame";

export interface ShellProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
  source: FilmSource;
  /** Text of the single visually hidden h1. */
  heading: string;
  /** aria-label of the lightbox. Also kept as visually hidden text. */
  lightboxLabel?: string;
  versions: string[];
  version: string;
  onVersionChange: (v: string) => void;
  /** Controlled; the app owns the intro state. */
  xray: boolean;
  onXrayChange: (next: boolean) => void;
  /** Identifies the case; the intro plays once per key. */
  introKey: string;
  /** Amount asked for, in integer cents. */
  claimedCents: number;
  onReplay?: () => void;
  onOverride?: () => void;
  overrideRef?: Ref<HTMLButtonElement>;
  onMessagesComplete?: () => void;
  effective?: EffectiveResult;
  headerActions?: ReactNode;
  /** Status text shown in the header, right of the tagline. */
  statusNote?: ReactNode;
  introPhase?: IntroPhase;
}

/**
 * Arranges all panels, the stage and the controls. It never evaluates or
 * replays rules: a version change only calls `onVersionChange`.
 */
export function Shell({
  trace,
  anatomy,
  source,
  heading,
  lightboxLabel,
  versions,
  version,
  onVersionChange,
  xray,
  onXrayChange,
  claimedCents,
  onReplay,
  onOverride,
  overrideRef,
  onMessagesComplete,
  effective,
  headerActions,
  statusNote,
  introPhase,
  reducedMotion,
  className,
}: ShellProps) {
  // exactOptionalPropertyTypes: only pass optional props that are defined.
  const motion = reducedMotion === undefined ? {} : { reducedMotion };
  return (
    <HoveredRuleProvider>
      <ShellFrame
        heading={heading}
        xray={xray}
        {...(headerActions !== undefined ? { headerActions } : {})}
        {...(lightboxLabel !== undefined ? { lightboxLabel } : {})}
        {...(statusNote !== undefined ? { statusNote } : {})}
        {...(introPhase !== undefined ? { introPhase } : {})}
        {...(className !== undefined ? { className } : {})}
        {...motion}
        controls={
          <ControlPanel
            trace={trace}
            anatomy={anatomy}
            versions={versions}
            value={version}
            onVersionChange={onVersionChange}
            xray={xray}
            onXrayChange={onXrayChange}
            {...motion}
          />
        }
      >
        <DocumentPanel trace={trace} anatomy={anatomy} source={source} {...motion} />
        <div className="xr-shell-stagecell">
          {lightboxLabel !== undefined && <span className="xr-visually-hidden">{lightboxLabel}</span>}
          {xray && <Stage trace={trace} anatomy={anatomy} {...motion} />}
          <GlassCard trace={trace} anatomy={anatomy} {...motion} />
        </div>
        <DoctorPanel
          trace={trace}
          anatomy={anatomy}
          claimedCents={claimedCents}
          {...(effective !== undefined ? { effective } : {})}
          {...(onReplay !== undefined ? { onReplay } : {})}
          {...(onOverride !== undefined ? { onOverride } : {})}
          {...(overrideRef !== undefined ? { overrideRef } : {})}
          {...(onMessagesComplete !== undefined ? { onMessagesComplete } : {})}
          {...motion}
        />
      </ShellFrame>
    </HoveredRuleProvider>
  );
}
