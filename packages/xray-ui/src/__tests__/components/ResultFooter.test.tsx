import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultFooter } from "../../components/panels/ResultFooter";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

const money = (_p: string, v: unknown) => `$${((v as number) / 100).toFixed(2)}`;
const anatomy = () => ({ ...signatureAnatomy(), formatValue: money });

describe("ResultFooter", () => {
  it("shows the result line and a progress bar", () => {
    const trace = { ...signatureTrace(), result: "partially_approved" as const, amountCents: 4150 };
    render(<ResultFooter trace={trace} anatomy={anatomy()} claimedCents={10000} />);
    const status = screen.getByRole("status");
    expect(status).toHaveClass("xr-result");
    expect(status).toHaveTextContent("PARTIALLY APPROVED $41.50");
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar.firstElementChild).toHaveStyle({ transform: "scaleX(0.415)" });
  });

  it("shows 0 % and no NaN when the amount asked for is 0", () => {
    const trace = { ...signatureTrace(), amountCents: 0 };
    const { container } = render(<ResultFooter trace={trace} anatomy={anatomy()} claimedCents={0} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(container.innerHTML).not.toContain("NaN");
  });

  it("calls each callback once per activation and wires overrideRef", async () => {
    const onReplay = vi.fn();
    const onOverride = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <ResultFooter
        trace={signatureTrace()}
        anatomy={anatomy()}
        claimedCents={10000}
        onReplay={onReplay}
        onOverride={onOverride}
        overrideRef={ref}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Replay decision" }));
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onOverride).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Human override" }));
    expect(onOverride).toHaveBeenCalledTimes(1);
    expect(ref.current).toBe(screen.getByRole("button", { name: "Human override" }));
  });

  it("shows the effective result and reviewer name", () => {
    const trace = { ...signatureTrace(), result: "partially_approved" as const };
    render(
      <ResultFooter
        trace={trace}
        anatomy={anatomy()}
        claimedCents={10000}
        effective={{ result: "approved", reviewerName: "Ada" }}
      />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("APPROVED");
    expect(status).toHaveTextContent("overruled by Ada");
    expect(status).toHaveTextContent("Rules decided: PARTIALLY APPROVED");
  });
});
