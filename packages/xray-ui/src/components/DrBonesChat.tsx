import { useMemo } from "react";
import { cx } from "../cx";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { buildChatMessages } from "../model/chat";
import type { DrBonesChatProps } from "../types";
import { ChatLog, DOTS_MS } from "./chat/ChatLog";

export { DOTS_MS };

function Avatar() {
  return (
    <svg className="xr-chat-avatar" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" className="xr-avatar-ring" />
      <ellipse cx="16" cy="14" rx="7" ry="8" className="xr-avatar-skull" />
      <circle cx="13" cy="13" r="1.8" className="xr-avatar-eye" />
      <circle cx="19" cy="13" r="1.8" className="xr-avatar-eye" />
      <path d="M12 24h8M13 21v3M16 21v3M19 21v3" className="xr-avatar-teeth" />
    </svg>
  );
}

export function DrBonesChat({
  trace,
  anatomy,
  speedMs,
  onMessagesComplete,
  onReplay,
  onOverride,
  reducedMotion,
  className,
}: DrBonesChatProps) {
  const reduced = useReducedMotion(reducedMotion);
  const messages = useMemo(() => buildChatMessages(trace, anatomy), [trace, anatomy]);
  const messagesKey = useMemo(() => messages.map((m) => m.id + ":" + m.text).join("\u0001"), [messages]);

  return (
    <section className={cx("xr-chat", className)} aria-label="Dr. Bones chat">
      <header className="xr-chat-head">
        <Avatar />
        <h3 className="xr-chat-title">Dr. Bones · Radiologist</h3>
      </header>
      <div className="xr-chat-log" role="log" aria-live="polite">
        <ChatLog
          key={messagesKey}
          messages={messages}
          reduced={reduced}
          speedMs={speedMs}
          onMessagesComplete={onMessagesComplete}
        />
      </div>
      {(onReplay || onOverride) && (
        <footer className="xr-chat-actions">
          {onReplay && (
            <button type="button" className="xr-chat-btn" onClick={onReplay}>
              Replay decision
            </button>
          )}
          {onOverride && (
            <button type="button" className="xr-chat-btn" onClick={onOverride}>
              Human override
            </button>
          )}
        </footer>
      )}
    </section>
  );
}
