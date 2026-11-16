import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { ChatLog, DOTS_MS } from "../../components/chat/ChatLog";
import type { ChatMessage } from "../../types";

const SPEED = 10;
const messages: ChatMessage[] = [
  { id: "a", kind: "greeting", text: "Hello there" },
  { id: "b", kind: "finding", text: "Second" },
] as ChatMessage[];

function advance(ms: number) {
  for (let i = 0; i < ms; i += 1) {
    act(() => {
      vi.advanceTimersByTime(1);
    });
  }
}

describe("ChatLog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the full text of every message at once when reduced motion is true", () => {
    const onDone = vi.fn();
    const { container } = render(
      <ChatLog messages={messages} reduced speedMs={SPEED} onMessagesComplete={onDone} />,
    );
    const texts = Array.from(container.querySelectorAll(".xr-bubble")).map((n) => n.textContent);
    expect(texts).toEqual(["Hello there", "Second"]);
    expect(container.querySelector(".xr-typing-dots")).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("types the text after the dots phase when reduced motion is false", () => {
    const { container } = render(
      <ChatLog messages={messages} reduced={false} speedMs={SPEED} onMessagesComplete={undefined} />,
    );
    expect(container.querySelector(".xr-typing-dots")).not.toBeNull();
    advance(DOTS_MS + SPEED * 3);
    expect(container.querySelector('[data-message-id="a"]')!.textContent).toBe("Hel");
    expect(container.querySelector('[data-message-id="b"]')).toBeNull();
  });
});
