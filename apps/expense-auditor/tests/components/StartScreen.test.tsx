import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StartScreen } from "../../src/ui/StartScreen";

const NAMES = ["Signature case", "Clean meal", "Outside the trip window"];

describe("StartScreen", () => {
  it("has the hidden h1 and three film sheets, each a button named by its title", () => {
    const { container } = render(<StartScreen busy={false} error={null} onLoadSample={() => {}} />);
    expect(screen.getByRole("heading", { level: 1, name: "Expense Auditor" })).toBeInTheDocument();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelectorAll(".xr-sheet")).toHaveLength(3);
    for (const name of NAMES) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Pick a receipt to X-ray." })).toBeInTheDocument();
    expect(screen.getByText("The AI reads the receipt. The rules decide.")).toBeInTheDocument();
  });

  it("has the three sample buttons with blurbs and calls onLoadSample with the id", async () => {
    const onLoadSample = vi.fn();
    render(<StartScreen busy={false} error={null} onLoadSample={onLoadSample} />);
    const group = screen.getByRole("group", { name: "Load sample receipt" });
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.querySelector(".xr-sheet-title")?.textContent)).toEqual(NAMES);
    for (const b of buttons) {
      expect(group).toContainElement(b);
      expect(b).toHaveAttribute("type", "button");
      expect(b).toHaveAccessibleDescription();
    }
    await userEvent.click(screen.getByRole("button", { name: "Signature case" }));
    await userEvent.click(screen.getByRole("button", { name: "Clean meal" }));
    await userEvent.click(screen.getByRole("button", { name: "Outside the trip window" }));
    expect(onLoadSample.mock.calls.map((c) => c[0])).toEqual(["signature", "clean", "outside-window"]);
  });

  it("has no file input and no date input", () => {
    const { container } = render(<StartScreen busy={false} error={null} onLoadSample={() => {}} />);
    expect(container.querySelector("input")).toBeNull();
  });

  describe("live controls", () => {
    const noop = () => {};
    const png = () => new File([new Uint8Array([1, 2, 3])], "r.png", { type: "image/png" });

    it("renders the labelled upload control and prefilled trip dates when liveAvailable", () => {
      render(<StartScreen busy={false} error={null} onLoadSample={noop} liveAvailable onLoadPhoto={noop} />);
      expect(screen.getByRole("group", { name: "Live receipt photo" })).toBeInTheDocument();
      expect(screen.getByLabelText("Upload receipt photo")).toHaveAttribute("accept", "image/jpeg,image/png");
      expect(screen.getByLabelText("Trip start")).toHaveValue("2024-03-10");
      expect(screen.getByLabelText("Trip end")).toHaveValue("2024-03-20");
      expect(screen.getByRole("button", { name: "Read receipt" })).toBeInTheDocument();
    });

    it("renders none of the live nodes when liveAvailable is false", () => {
      const { container } = render(<StartScreen busy={false} error={null} onLoadSample={noop} />);
      expect(screen.queryByLabelText("Upload receipt photo")).toBeNull();
      expect(screen.queryByLabelText("Trip start")).toBeNull();
      expect(screen.queryByLabelText("Trip end")).toBeNull();
      expect(screen.queryByRole("button", { name: "Read receipt" })).toBeNull();
      expect(screen.queryByRole("group", { name: "Live receipt photo" })).toBeNull();
      expect(container.querySelector("input")).toBeNull();
    });

    it("shows a message for a .gif and calls neither fetch nor onLoadPhoto", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const onLoadPhoto = vi.fn();
      const user = userEvent.setup({ applyAccept: false });
      render(<StartScreen busy={false} error={null} onLoadSample={noop} liveAvailable onLoadPhoto={onLoadPhoto} />);
      await user.upload(
        screen.getByLabelText("Upload receipt photo"),
        new File([new Uint8Array([1])], "x.gif", { type: "image/gif" }),
      );
      expect(screen.getByRole("alert")).toHaveTextContent("Choose a JPEG or PNG photo.");
      expect(screen.getByRole("region", { name: "Expense Auditor - RECORDED" })).toBeInTheDocument();
      expect(onLoadPhoto).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it("shows a message for an oversized prepared image and calls neither fetch nor onLoadPhoto", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const onLoadPhoto = vi.fn();
      const prepare = vi.fn(async () => ({
        reason: "too_large" as const,
        message: "This photo is too large even after shrinking.",
      }));
      render(
        <StartScreen busy={false} error={null} onLoadSample={noop} liveAvailable onLoadPhoto={onLoadPhoto} prepare={prepare} />,
      );
      await userEvent.upload(screen.getByLabelText("Upload receipt photo"), png());
      await userEvent.click(screen.getByRole("button", { name: "Read receipt" }));
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole("alert")).toHaveTextContent("too large");
      expect(onLoadPhoto).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it("changes the hidden lightbox label to LIVE once a valid file is selected", async () => {
      render(<StartScreen busy={false} error={null} onLoadSample={noop} liveAvailable onLoadPhoto={noop} />);
      expect(screen.getByRole("region", { name: "Expense Auditor - RECORDED" })).toBeInTheDocument();
      await userEvent.upload(screen.getByLabelText("Upload receipt photo"), png());
      expect(screen.getByRole("region", { name: "Expense Auditor - LIVE" })).toBeInTheDocument();
    });
  });

  it("busy disables the buttons and shows the status", () => {
    render(<StartScreen busy error={null} onLoadSample={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Reading receipt");
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
  });

  it("is idle without a status and shows an error panel for an error", () => {
    const { rerender } = render(<StartScreen busy={false} error={null} onLoadSample={() => {}} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(
      <StartScreen
        busy={false}
        error={{ kind: "core", error: { kind: "fixture_not_found", message: "x", fixturePath: "recorded/x.json" } }}
        onLoadSample={() => {}}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The recorded receipt could not be loaded.");
  });
});
