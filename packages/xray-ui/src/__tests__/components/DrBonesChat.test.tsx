import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { DrBonesChat, DOTS_MS } from "../../components/DrBonesChat";
import { buildChatMessages } from "../../model/chat";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

const SPEED = 10;

function bubble(container: HTMLElement, id: string): HTMLElement | null {
  return container.querySelector(`[data-message-id="${id}"]`);
}

function advance(ms: number) {
  // One act per millisecond so React flushes effects between chained timers.
  for (let i = 0; i < ms; i += 1) {
    act(() => {
      vi.advanceTimersByTime(1);
    });
  }
}

describe("DrBonesChat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const messages = buildChatMessages(signatureTrace(), signatureAnatomy());
  const totalMs = messages.reduce((n, m) => n + DOTS_MS + m.text.length * SPEED + SPEED, 0);

  it("shows the title and an aria-live polite log", () => {
    render(<DrBonesChat trace={signatureTrace()} anatomy={signatureAnatomy()} speedMs={SPEED} />);
    expect(screen.getByText("Dr. Bones · Radiologist")).toBeInTheDocument();
    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
  });

  it("shows typing dots, then types characters one by one", () => {
    const { container } = render(
      <DrBonesChat trace={signatureTrace()} anatomy={signatureAnatomy()} speedMs={SPEED} />,
    );
    const greeting = messages[0]!.text;
    expect(container.querySelector(".xr-typing-dots")).not.toBeNull();

    advance(DOTS_MS);
    expect(container.querySelector(".xr-typing-dots")).toBeNull();
    expect(bubble(container, "greeting")!.textContent).toBe("");

    advance(SPEED * 3);
    expect(bubble(container, "greeting")!.textContent).toBe(greeting.slice(0, 3));

    advance(SPEED * greeting.length);
    expect(bubble(container, "greeting")!.textContent).toBe(greeting);
  });

  it("renders no text node for a message during its dots phase", () => {
    const { container } = render(
      <DrBonesChat trace={signatureTrace()} anatomy={signatureAnatomy()} speedMs={SPEED} />,
    );
    const first = bubble(container, "greeting")!;
    expect(first.textContent).toBe("");
    expect(screen.queryByText(messages[0]!.text)).toBeNull();

    // Finish the first message; the second must be in its dots phase with no text.
    advance(DOTS_MS + messages[0]!.text.length * SPEED + SPEED);
    expect(bubble(container, "greeting")!.textContent).toBe(messages[0]!.text);
    const second = bubble(container, messages[1]!.id)!;
    expect(second).not.toBeNull();
    expect(second.textContent).toBe("");
    expect(second.querySelector(".xr-typing-dots")).not.toBeNull();
    const hasText = Array.from(second.childNodes).some((n) => n.nodeType === Node.TEXT_NODE);
    expect(hasText).toBe(false);
  });

  it("calls onMessagesComplete exactly once after all messages are typed", () => {
    const onComplete = vi.fn();
    const { container } = render(
      <DrBonesChat
        trace={signatureTrace()}
        anatomy={signatureAnatomy()}
        speedMs={SPEED}
        onMessagesComplete={onComplete}
      />,
    );
    advance(Math.floor(totalMs / 2));
    expect(onComplete).not.toHaveBeenCalled();
    advance(totalMs);
    expect(onComplete).toHaveBeenCalledTimes(1);
    advance(totalMs);
    expect(onComplete).toHaveBeenCalledTimes(1);
    const last = messages[messages.length - 1]!;
    expect(bubble(container, last.id)!.textContent).toBe(last.text);
  });

  it("shows Replay and Override buttons only when callbacks are given and calls them", () => {
    const onReplay = vi.fn();
    const onOverride = vi.fn();
    const { rerender } = render(
      <DrBonesChat
        trace={signatureTrace()}
        anatomy={signatureAnatomy()}
        onReplay={onReplay}
        reducedMotion
      />,
    );
    expect(screen.getByRole("button", { name: "Replay decision" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Human override" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Replay decision" }));
    expect(onReplay).toHaveBeenCalledTimes(1);

    rerender(
      <DrBonesChat
        trace={signatureTrace()}
        anatomy={signatureAnatomy()}
        onOverride={onOverride}
        reducedMotion
      />,
    );
    expect(screen.queryByRole("button", { name: "Replay decision" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Human override" }));
    expect(onOverride).toHaveBeenCalledTimes(1);

    rerender(
      <DrBonesChat
        trace={signatureTrace()}
        anatomy={signatureAnatomy()}
        onReplay={onReplay}
        onOverride={onOverride}
        reducedMotion
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("renders no footer or buttons when neither callback is given", () => {
    const { container } = render(
      <DrBonesChat trace={signatureTrace()} anatomy={signatureAnatomy()} reducedMotion />,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(container.querySelector("footer")).toBeNull();
  });

  it("with reduced motion shows all full text immediately and no typing phase", () => {
    const onComplete = vi.fn();
    const { container } = render(
      <DrBonesChat
        trace={signatureTrace()}
        anatomy={signatureAnatomy()}
        reducedMotion
        onMessagesComplete={onComplete}
      />,
    );
    expect(container.querySelector(".xr-typing-dots")).toBeNull();
    for (const m of messages) {
      expect(bubble(container, m.id)!.textContent).toBe(m.text);
    }
    expect(onComplete).toHaveBeenCalledTimes(1);
    advance(totalMs);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
