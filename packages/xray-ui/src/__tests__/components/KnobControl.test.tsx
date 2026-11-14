import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KnobControl } from "../../components/KnobControl";
import { signatureTrace } from "../helpers/fixtures";

const VERSIONS = ["v1", "v2", "v3"];

function setup(value: string, versions: string[] = VERSIONS) {
  const onVersionChange = vi.fn();
  const utils = render(
    <KnobControl versions={versions} value={value} onVersionChange={onVersionChange} />,
  );
  const slider = screen.getByRole("slider");
  return { onVersionChange, slider, ...utils };
}

const pointerAngle = (container: HTMLElement): string | null =>
  container.querySelector(".xr-knob-pointer")?.getAttribute("data-angle") ?? null;

describe("KnobControl", () => {
  it("exposes a slider role with an accessible name and value state", () => {
    const { slider } = setup("v2");
    expect(slider).toHaveAccessibleName("Rule version");
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "2");
    expect(slider).toHaveAttribute("aria-valuenow", "1");
    expect(slider).toHaveAttribute("aria-valuetext", "v2");
  });

  it("uses a custom label as the accessible name", () => {
    render(<KnobControl versions={VERSIONS} value="v1" onVersionChange={() => {}} label="Regelversion" />);
    expect(screen.getByRole("slider")).toHaveAccessibleName("Regelversion");
  });

  it("renders one detent per version", () => {
    const { container } = setup("v1");
    expect(container.querySelectorAll("g.xr-knob-detent")).toHaveLength(3);
  });

  it.each(["ArrowRight", "ArrowUp"])("%s steps to the next version", async (key) => {
    const user = userEvent.setup();
    const { slider, onVersionChange } = setup("v1");
    slider.focus();
    await user.keyboard(`{${key}}`);
    expect(onVersionChange).toHaveBeenCalledTimes(1);
    expect(onVersionChange).toHaveBeenCalledWith("v2");
  });

  it.each(["ArrowLeft", "ArrowDown"])("%s steps to the previous version", async (key) => {
    const user = userEvent.setup();
    const { slider, onVersionChange } = setup("v3");
    slider.focus();
    await user.keyboard(`{${key}}`);
    expect(onVersionChange).toHaveBeenCalledTimes(1);
    expect(onVersionChange).toHaveBeenCalledWith("v2");
  });

  it("Home and End jump to the first and last version", async () => {
    const user = userEvent.setup();
    const { slider, onVersionChange } = setup("v2");
    slider.focus();
    await user.keyboard("{Home}");
    expect(onVersionChange).toHaveBeenLastCalledWith("v1");
    await user.keyboard("{End}");
    expect(onVersionChange).toHaveBeenLastCalledWith("v3");
    expect(onVersionChange).toHaveBeenCalledTimes(2);
  });

  it("makes no call when a step key would pass the first or last version", async () => {
    const user = userEvent.setup();
    const first = setup("v1");
    first.slider.focus();
    await user.keyboard("{ArrowLeft}{ArrowDown}{Home}");
    expect(first.onVersionChange).not.toHaveBeenCalled();
    first.unmount();

    const last = setup("v3");
    last.slider.focus();
    await user.keyboard("{ArrowRight}{ArrowUp}{End}");
    expect(last.onVersionChange).not.toHaveBeenCalled();
  });

  it("ignores unrelated keys", async () => {
    const user = userEvent.setup();
    const { slider, onVersionChange } = setup("v2");
    slider.focus();
    await user.keyboard("a{Enter}{PageUp}");
    expect(onVersionChange).not.toHaveBeenCalled();
  });

  it("handles an empty versions list without crashing or calling back", async () => {
    const user = userEvent.setup();
    const { slider, onVersionChange, container } = setup("v1", []);
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "0");
    expect(container.querySelectorAll("g.xr-knob-detent")).toHaveLength(0);
    expect(pointerAngle(container)).toBe("0");
    slider.focus();
    await user.keyboard("{ArrowRight}{ArrowLeft}{Home}{End}");
    expect(onVersionChange).not.toHaveBeenCalled();
  });

  it("rests at the first detent when value is not in the list", async () => {
    const user = userEvent.setup();
    const { slider, onVersionChange, container } = setup("v9");
    expect(slider).toHaveAttribute("aria-valuenow", "0");
    expect(pointerAngle(container)).toBe("-120");
    expect(container.querySelector('g.xr-knob-detent[data-active="true"]')).toBeNull();
    slider.focus();
    await user.keyboard("{ArrowRight}");
    expect(onVersionChange).toHaveBeenCalledWith("v1");
  });

  it.each([
    ["v1", "-120"],
    ["v2", "0"],
    ["v3", "120"],
  ])("rotates the pointer for value %s to %s degrees", (value, angle) => {
    const { container } = setup(value);
    expect(pointerAngle(container)).toBe(angle);
    const pointer = container.querySelector(".xr-knob-pointer");
    expect(pointer).toHaveAttribute("transform", `rotate(${angle} 50 50)`);
    expect(container.querySelector('g.xr-knob-detent[data-active="true"]')).toHaveTextContent(value);
  });

  it("places a single version at 0 degrees", () => {
    const { container } = setup("v1", ["v1"]);
    expect(pointerAngle(container)).toBe("0");
  });

  it("calls the callback with the version of a clicked tick hit-target", async () => {
    const user = userEvent.setup();
    const { onVersionChange, container } = setup("v1");
    const hits = container.querySelectorAll<HTMLButtonElement>("button.xr-knob-hit");
    expect(hits).toHaveLength(3);
    await user.click(hits[2]!);
    expect(onVersionChange).toHaveBeenCalledTimes(1);
    expect(onVersionChange).toHaveBeenCalledWith("v3");
    await user.click(hits[1]!);
    expect(onVersionChange).toHaveBeenLastCalledWith("v2");
  });

  it("performs no rule evaluation and leaves a trace untouched", async () => {
    const user = userEvent.setup();
    const trace = signatureTrace();
    const snapshot = JSON.stringify(trace);
    const versions = [...VERSIONS];
    const onVersionChange = vi.fn();
    render(<KnobControl versions={versions} value="v1" onVersionChange={onVersionChange} />);
    screen.getByRole("slider").focus();
    await user.keyboard("{ArrowRight}{End}");
    expect(JSON.stringify(trace)).toBe(snapshot);
    expect(versions).toEqual(VERSIONS);
    // The knob only reports the chosen version string; it does not change its own value.
    expect(onVersionChange.mock.calls).toEqual([["v2"], ["v3"]]);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "v1");
  });
});
