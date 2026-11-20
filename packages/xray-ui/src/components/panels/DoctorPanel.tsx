import { useMemo } from "react";
import type { Ref } from "react";
import { drBonesUrl } from "../../assets";
import { cx } from "../../cx";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { buildChatMessages } from "../../model/chat";
import type { Anatomy, CommonProps, EffectiveResult, Trace } from "../../types";
import { ChatLog } from "../chat/ChatLog";
import { AssetImage } from "../shell/AssetImage";
import { ResultFooter } from "./ResultFooter";

export interface DoctorPanelProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
  /** Amount asked for, in integer cents. */
  claimedCents: number;
  effective?: EffectiveResult;
  speedMs?: number;
  onMessagesComplete?: () => void;
  onReplay?: () => void;
  onOverride?: () => void;
  overrideRef?: Ref<HTMLButtonElement>;
}

/**
 * Phone-shaped Dr. Bones panel: notch, header with avatar, a scrolling chat log
 * and the result footer. Message text comes only from the chat builder.
 */
export function DoctorPanel({
  trace,
  anatomy,
  claimedCents,
  effective,
  speedMs,
  onMessagesComplete,
  onReplay,
  onOverride,
  overrideRef,
  reducedMotion,
  className,
}: DoctorPanelProps) {
  const reduced = useReducedMotion(reducedMotion);
  const messages = useMemo(() => buildChatMessages(trace, anatomy), [trace, anatomy]);
  const messagesKey = useMemo(() => messages.map((m) => m.id + ":" + m.text).join("\u0001"), [messages]);

  return (
    <section className={cx("xr-doctor", className)} aria-label="Dr. Bones chat">
      <span className="xr-doctor-notch" aria-hidden="true" />
      <header className="xr-doctor-head">
        <AssetImage className="xr-doctor-avatar" src={drBonesUrl} width={512} height={512} />
        <h3 className="xr-doctor-title">Dr. Bones · Radiologist</h3>
      </header>
      <div className="xr-doctor-body xr-chat-log" role="log" aria-live="polite">
        <ChatLog
          key={messagesKey}
          messages={messages}
          reduced={reduced}
          speedMs={speedMs}
          onMessagesComplete={onMessagesComplete}
        />
      </div>
      <ResultFooter
        trace={trace}
        anatomy={anatomy}
        claimedCents={claimedCents}
        {...(effective === undefined ? {} : { effective })}
        {...(onReplay === undefined ? {} : { onReplay })}
        {...(onOverride === undefined ? {} : { onOverride })}
        {...(overrideRef === undefined ? {} : { overrideRef })}
      />
      <span className="xr-doctor-home" aria-hidden="true" />
    </section>
  );
}
