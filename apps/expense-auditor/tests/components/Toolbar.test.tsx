import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isCoreError, override, replay } from "@bones/core";
import { SAMPLES } from "../../src/extraction/samples";
import { makePortFactory } from "../../src/pipeline/ports";
import { createSessionStore } from "../../src/state/sessionStore";
import type { DecisionState } from "../../src/state/reducer";
import { displayedTrace } from "../../src/state/selectors";
import { buildExport, exportFileName, serializeExport } from "../../src/export/exportTrace";
import { Toolbar } from "../../src/ui/Toolbar";
import { counterPorts } from "../helpers/fakes";
import { loadTestBundle } from "../helpers/fixtures";

async function loadedStore() {
  const bundle = loadTestBundle();
  if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));
  const store = createSessionStore({
    bundle,
    samples: SAMPLES,
    portFactory: makePortFactory(counterPorts()),
    sha256: async () => "ab".repeat(32),
    replayFn: replay,
    overrideFn: override,
    prefersReducedMotion: () => false,
  });
  await store.loadSample("signature");
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Toolbar", () => {
  it("has two typed buttons in a labelled toolbar", async () => {
    const store = await loadedStore();
    render(
      <Toolbar
        state={store.getState() as DecisionState}
        store={store}
      />,
    );
    const bar = screen.getByRole("toolbar", { name: "Decision actions" });
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Download trace", "Load another receipt"]);
    for (const b of buttons) expect(b).toHaveAttribute("type", "button");
    expect(bar).toContainElement(buttons[0] as HTMLElement);
  });

  it("Download trace uses the injected download and makes no network request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const store = await loadedStore();
    const state = store.getState() as DecisionState;
    const download = vi.fn();
    render(
      <Toolbar
        state={state}
        store={store}
        download={download}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Download trace" }));
    expect(download).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledWith(
      exportFileName(displayedTrace(state)),
      serializeExport(buildExport(state)),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Load another receipt resets the store", async () => {
    const store = await loadedStore();
    render(
      <Toolbar
        state={store.getState() as DecisionState}
        store={store}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Load another receipt" }));
    expect(store.getState().screen).toBe("start");
  });
});
