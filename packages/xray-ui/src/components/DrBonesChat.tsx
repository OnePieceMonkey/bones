import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../cx";
import { animClass, useReducedMotion } from "../hooks/useReducedMotion";
import { useTypewriter } from "../hooks/useTypewriter";
import { buildChatMessages } from "../model/chat";
import type { ChatMessage, DrBonesChatProps } from "../types";

/** How long the typing dots show before a message starts typing. */
export const DOTS_MS = 600;

function Bubble({ message, text }: { message: ChatMessage; text: string }) {
  return (
    <div className={cx("xr-bubble", `xr-bubble--${message.kind}`)} data-message-id={message.id}>
      {text}
    </div>
  );
}

interface TypingBubbleProps {
  message: ChatMessage;
  speedMs: number | undefined;
  onDone: () => void;
}

function TypingBubble({ message, speedMs, onDone }: TypingBubbleProps) {
  const [phase, setPhase] = useState<"dots" | "typing">("dots");
  useEffect(() => {
    const id = setTimeout(() => setPhase("typing"), DOTS_MS);
    return () => clearTimeout(id);
  }, []);
  const { shown, done } = useTypewriter(message.text, {
    reducedMotion: false,
    enabled: phase === "typing",
    ...(speedMs !== undefined ? { speedMs } : {}),
  });
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = phase === "typing" && done;
  useEffect(() => {
    if (finished) doneRef.current();
  }, [finished]);

  if (phase === "dots") {
    return (
      <div className={cx("xr-bubble", `xr-bubble--${message.kind}`)} data-message-id={message.id}>
        <span className={cx("xr-typing-dots", animClass(false, "dots"))} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
    );
  }
  return <Bubble message={message} text={shown} />;
}

interface InnerProps {
  messages: ChatMessage[];
  reduced: boolean;
  speedMs: number | undefined;
  onMessagesComplete: (() => void) | undefined;
}

function ChatLog({ messages, reduced, speedMs, onMessagesComplete }: InnerProps) {
  const [active, setActive] = useState(0);
  const completeRef = useRef(onMessagesComplete);
  completeRef.current = onMessagesComplete;
  const firedRef = useRef(false);
  const allDone = reduced || active >= messages.length;

  useEffect(() => {
    if (!allDone || firedRef.current) return;
    firedRef.current = true;
    completeRef.current?.();
  }, [allDone]);

  if (reduced) {
    return (
      <>
        {messages.map((m) => (
          <Bubble key={m.id} message={m} text={m.text} />
        ))}
      </>
    );
  }
  const current = messages[active];
  return (
    <>
      {messages.slice(0, active).map((m) => (
        <Bubble key={m.id} message={m} text={m.text} />
      ))}
      {current && (
        <TypingBubble
          key={current.id}
          message={current}
          speedMs={speedMs}
          onDone={() => setActive((a) => a + 1)}
        />
      )}
    </>
  );
}

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
