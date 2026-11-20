import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DoctorPanel } from "../../components/panels/DoctorPanel";
import { buildChatMessages } from "../../model/chat";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

const money = (_p: string, v: unknown) => `$${((v as number) / 100).toFixed(2)}`;
const anatomy = () => ({ ...signatureAnatomy(), formatValue: money });

describe("DoctorPanel", () => {
  it("shows the header with a decorative avatar and the name", () => {
    const { container } = render(
      <DoctorPanel trace={signatureTrace()} anatomy={anatomy()} claimedCents={10000} reducedMotion />,
    );
    // visual-polish-2 R6.2 supersedes visual-polish R8: title is "Dr. Bones · Radiologist".
    expect(screen.getByRole("heading", { name: "Dr. Bones · Radiologist" })).toBeInTheDocument();
    const img = container.querySelector("img.xr-doctor-avatar")!;
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("aria-hidden", "true");
    expect(img).toHaveAttribute("width", "512");
    expect(container.querySelector(".xr-doctor-notch")).toHaveAttribute("aria-hidden", "true");
    const home = container.querySelector(".xr-doctor-home");
    expect(home).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".xr-doctor")!.lastElementChild).toBe(home);
  });

  it("renders a polite log with the full chat text at once in reduced motion", () => {
    const trace = signatureTrace();
    const a = anatomy();
    const onDone = vi.fn();
    render(<DoctorPanel trace={trace} anatomy={a} claimedCents={10000} reducedMotion onMessagesComplete={onDone} />);
    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
    const expected = buildChatMessages(trace, a).map((m) => m.text);
    const shown = Array.from(log.querySelectorAll(".xr-bubble")).map((n) => n.textContent);
    expect(shown).toEqual(expected);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("shows typing dots instead of text when motion is on", () => {
    const { container } = render(
      <DoctorPanel trace={signatureTrace()} anatomy={anatomy()} claimedCents={10000} reducedMotion={false} />,
    );
    expect(container.querySelector(".xr-typing-dots")).not.toBeNull();
  });

  it("renders the footer and wires both buttons", async () => {
    const onReplay = vi.fn();
    const onOverride = vi.fn();
    render(
      <DoctorPanel
        trace={signatureTrace()}
        anatomy={anatomy()}
        claimedCents={10000}
        reducedMotion
        onReplay={onReplay}
        onOverride={onOverride}
      />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Replay decision" }));
    await userEvent.click(screen.getByRole("button", { name: "Human override" }));
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onOverride).toHaveBeenCalledTimes(1);
  });
});
