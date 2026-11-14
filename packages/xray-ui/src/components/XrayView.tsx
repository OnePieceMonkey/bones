import { useState } from "react";
import { cx } from "../cx";
import { HoveredRuleProvider } from "../hooks/useHoveredRule";
import type { XrayViewProps } from "../types";
import { AnswerCard } from "./AnswerCard";
import { ControlStrip } from "./ControlStrip";
import { DrBonesChat } from "./DrBonesChat";
import { EcgLine } from "./EcgLine";
import { FilmClip } from "./FilmClip";
import { Lightbox } from "./Lightbox";
import { ResultPlate } from "./ResultPlate";
import { Skeleton } from "./Skeleton";

/**
 * Arranges the X-ray components. It never evaluates or replays rules:
 * a version change only calls `onVersionChange`.
 */
export function XrayView({
  trace,
  anatomy,
  source,
  title,
  versions,
  version,
  onVersionChange,
  xray: xrayProp,
  onXrayChange,
  onReplay,
  onOverride,
  onMessagesComplete,
  reducedMotion,
  className,
}: XrayViewProps) {
  const [internalXray, setInternalXray] = useState(true);
  const xray = xrayProp ?? internalXray;

  const handleXrayChange = (next: boolean): void => {
    if (xrayProp === undefined) setInternalXray(next);
    onXrayChange?.(next);
  };

  const plain = xray ? undefined : "xr--plain";
  // exactOptionalPropertyTypes: only pass optional props that are defined.
  const motion = reducedMotion === undefined ? {} : { reducedMotion };

  return (
    <HoveredRuleProvider>
      <Lightbox xray={xray} {...(title === undefined ? {} : { title })} {...motion}>
        <div className={cx("xr-view", className)} data-xray={xray ? "true" : "false"}>
          <FilmClip
            className={cx("xr-view-film", plain)}
            trace={trace}
            anatomy={anatomy}
            source={source}
            {...motion}
          />
          <AnswerCard className={cx("xr-view-answer", plain)} trace={trace} anatomy={anatomy} {...motion} />
          {xray ? (
            <>
              <Skeleton className="xr-view-skeleton" trace={trace} anatomy={anatomy} {...motion} />
              <EcgLine className="xr-view-ecg" trace={trace} anatomy={anatomy} {...motion} />
            </>
          ) : (
            <p className="xr-view-skeleton xr-skeleton-hidden">Skeleton hidden</p>
          )}
          <DrBonesChat
            className="xr-view-chat"
            trace={trace}
            anatomy={anatomy}
            {...motion}
            {...(onReplay === undefined ? {} : { onReplay })}
            {...(onOverride === undefined ? {} : { onOverride })}
            {...(onMessagesComplete === undefined ? {} : { onMessagesComplete })}
          />
          <ControlStrip
            className="xr-view-strip"
            trace={trace}
            anatomy={anatomy}
            versions={versions}
            value={version}
            onVersionChange={onVersionChange}
            xray={xray}
            onXrayChange={handleXrayChange}
            {...motion}
          />
          <ResultPlate className="xr-view-result" trace={trace} anatomy={anatomy} {...motion} />
        </div>
      </Lightbox>
    </HoveredRuleProvider>
  );
}
