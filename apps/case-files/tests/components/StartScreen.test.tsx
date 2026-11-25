import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StartScreen } from "../../src/ui/StartScreen";
import { App } from "../../src/App";
const TITLES = ["The Midnight Greenhouse", "Two Candlesticks", "The Empty Room"];
describe("StartScreen", () => {
  it("has one hidden h1 and three sheets in order, each with the recorded-demo note", () => {
    const { container } = render(<StartScreen busy={false} error={null} onLoadCase={() => {}} />);
    expect(screen.getByRole("heading", { level: 1, name: "Bones Case Files" })).toBeInTheDocument();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    const sheets = [...container.querySelectorAll(".xr-sheet")];
    expect(sheets).toHaveLength(3);
    expect(sheets.map((s) => s.querySelector(".xr-sheet-title")?.textContent)).toEqual(TITLES);
    for (const s of sheets) expect(s.querySelector(".xr-sheet-note")).toHaveTextContent("Recorded demo case");
    expect(screen.getAllByText("Recorded demo case")).toHaveLength(3);
    for (const s of sheets) {
      expect(s).toHaveAccessibleDescription(/^A /);
      expect(s.querySelectorAll(".xr-sheet-line").length).toBeGreaterThanOrEqual(3);
      expect(s.querySelector(".xr-sheet-paper")).toHaveTextContent("3 suspects");
    }
  });
  it("calls onLoadCase with the id on click and on keyboard activation", async () => {
    const onLoadCase = vi.fn();
    render(<StartScreen busy={false} error={null} onLoadCase={onLoadCase} />);
    await userEvent.click(screen.getByRole("button", { name: "The Midnight Greenhouse" }));
    screen.getByRole("button", { name: "Two Candlesticks" }).focus();
    await userEvent.keyboard("{Enter}");
    screen.getByRole("button", { name: "The Empty Room" }).focus();
    await userEvent.keyboard(" ");
    expect(onLoadCase.mock.calls.map((c) => c[0])).toEqual(["greenhouse", "candlesticks", "empty-room"]);
  });
  it("shows the live card disabled with the note while live mode is off", async () => {
    const onWriteCase = vi.fn();
    render(<StartScreen busy={false} error={null} onLoadCase={() => {}} onWriteCase={onWriteCase} />);
    const group = screen.getByRole("group", { name: "Write a new case" });
    expect(group).toBeDisabled();
    expect(screen.getByText("Live mode is off on this server. Pick a recorded case.")).toBeVisible();
    expect(screen.getByLabelText("Theme")).toBeDisabled();
    expect(screen.getAllByRole("option")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Write case" })).toBeDisabled();
    expect(onWriteCase).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "The Empty Room" })).toBeEnabled();
  });
  it("enables the live card when live mode is on", async () => {
    const onWriteCase = vi.fn();
    render(<StartScreen busy={false} error={null} onLoadCase={() => {}} liveAvailable onWriteCase={onWriteCase} />);
    await userEvent.selectOptions(screen.getByLabelText("Theme"), "lighthouse");
    await userEvent.click(screen.getByRole("button", { name: "Write case" }));
    expect(onWriteCase).toHaveBeenCalledWith("lighthouse");
  });
  it("shows a start error in an alert", () => {
    render(
      <StartScreen
        busy={false}
        error={{ kind: "core", error: { kind: "fixture_not_found", message: "m", fixturePath: "p" } }}
        onLoadCase={() => {}}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The recorded case could not be loaded.");
  });
});
describe("App", () => {
  it("shows the bundle error", () => {
    render(
      <App bundleError={{ kind: "fixture_invalid", message: "m", fixturePath: "p", parseError: "e" }} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The rules could not be loaded");
  });
});
