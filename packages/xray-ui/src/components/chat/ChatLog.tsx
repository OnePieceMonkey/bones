import { useEffect, useRef, useState } from "react";
import { cx } from "../../cx";
import { animClass } from "../../hooks/useReducedMotion";
import { useTypewriter } from "../../hooks/useTypewriter";
import type { ChatMessage } from "../../types";

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

export interface ChatLogProps {
  messages: ChatMessage[];
  reduced: boolean;
  speedMs: number | undefined;
  onMessagesComplete: (() => void) | undefined;
}

export function ChatLog({ messages, reduced, speedMs, onMessagesComplete }: ChatLogProps) {
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
