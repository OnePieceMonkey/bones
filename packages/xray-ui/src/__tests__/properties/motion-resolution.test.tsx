// Feature: visual-polish, Property 12: Reduced-motion resolution
import { afterEach, describe, it, expect } from "vitest";
import fc from "fast-check";
import { act, cleanup, render } from "@testing-library/react";
import { Shell } from "../../components/shell/Shell";
import { ShellFrame } from "../../components/shell/ShellFrame";
import { buildChatMessages } from "../../model/chat";
import { hotspotState } from "../../model/hotspotState";
import { motionMode } from "../../model/motion";
import { selectBones } from "../../model/selectors";
import type { Anatomy, FilmSource, Trace } from "../../types";
import { arbTraceAndAnatomy } from "../helpers/arbitraries";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";
import { dispatchMatchMediaChange, installMatchMedia, restoreMatchMedia } from "../helpers/matchMedia";

const source: FilmSource = { kind: "text", text: "Trattoria Roma\n2024-05-14\nWine 6.50\nTotal 480.00" };

function shell(
  trace: Trace,
  anatomy: Anatomy,
  prop: boolean | undefined,
  version = "v1",
  introKey = "case-1",
) {
  return (
    <Shell
      trace={trace}
      anatomy={anatomy}
      source={source}
      heading="Audit"
      versions={["v1", "v2", "v3"]}
      version={version}
      onVersionChange={() => {}}
      xray={true}
      onXrayChange={() => {}}
      introKey={introKey}
      claimedCents={48_000}
      {...(prop !== undefined ? { reducedMotion: prop } : {})}
    />
  );
}

const animElements = (c: Element): Element[] =>
  [...c.querySelectorAll("*")].filter((el) => /(^|\s)anim-/.test(el.getAttribute("class") ?? ""));

afterEach(() => {
  cleanup();
  restoreMatchMedia();
});

describe("Property 12: reduced-motion resolution", () => {
  it("resolves data-motion, xr-live, anim- classes and data-intro from prop and media query", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<boolean | undefined>(true, false, undefined),
        fc.boolean(),
        fc.constantFrom<"idle" | "running" | "done">("idle", "running", "done"),
        fc.boolean(),
        (prop, media, phase, xray) => {
          // Validates: Requirements 8.3, 12.6, 15.1, 15.2, 15.4, 15.5, 15.6, 15.7
          installMatchMedia(media);
          const { container, unmount } = render(
            <ShellFrame
              heading="h"
              xray={xray}
              introPhase={phase}
              {...(prop !== undefined ? { reducedMotion: prop } : {})}
            />,
          );
          const root = container.querySelector(".xr-shell") as HTMLElement;
          const reduced = prop ?? media;
          expect(root.dataset.motion).toBe(prop === true ? "reduce" : prop === false ? "full" : "auto");
          expect(root.classList.contains("xr-live")).toBe(!reduced);
          if (reduced) {
            expect(root.dataset.intro).toBe("done");
            const animated = [...container.querySelectorAll("*")].filter((el) =>
              /(^|\s)anim-/.test(el.getAttribute("class") ?? ""),
            );
            expect(animated).toHaveLength(0);
          } else {
            expect(root.dataset.intro).toBe(phase);
          }
          unmount();
          restoreMatchMedia();
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Property 12: reduced motion across the full Shell", () => {
  it("is final on the first render for generated traces", () => {
    fc.assert(
      fc.property(
        arbTraceAndAnatomy,
        fc.constantFrom<boolean | undefined>(true, undefined),
        (generated, prop) => {
          // Validates: Requirements 8.3, 10.12, 12.6, 13.7, 14.7, 15.1, 15.2, 15.4, 15.5, 15.6, 15.7, 17.8
          const { trace, anatomy } = generated;
          // prop true always reduces; prop undefined reduces through the media query.
          installMatchMedia(true);
          const { container, unmount } = render(shell(trace, anatomy, prop));
          const root = container.querySelector(".xr-shell") as HTMLElement;
          expect(root.dataset.motion).toBe(motionMode(prop));
          expect(root.dataset.intro).toBe("done");
          expect(container.querySelector(".xr-live")).toBeNull();
          expect(animElements(container)).toHaveLength(0);
          expect(container.querySelector(".xr-shake-a, .xr-shake-b")).toBeNull();
          expect(container.querySelector(".xr-typing-dots")).toBeNull();

          const log = container.querySelector('[role="log"]') as HTMLElement;
          for (const m of buildChatMessages(trace, anatomy)) {
            const bubble = log.querySelector(`[data-message-id="${CSS.escape(m.id)}"]`);
            expect(bubble?.textContent).toBe(m.text);
          }

          const bones = selectBones(trace, anatomy);
          const hotspots = [...container.querySelectorAll<HTMLElement>(".xr-hotspot")];
          expect(hotspots).toHaveLength(bones.length);
          for (const bone of bones) {
            const hs = hotspots.find((h) => h.dataset["ruleId"] === bone.ruleId) as HTMLElement;
            const state = hotspotState(bone);
            expect(hs.dataset["state"]).toBe(state);
            const wrap = hs.parentElement as HTMLElement;
            expect(hs.querySelector(".xr-fx")).toBeNull();
            expect(wrap.querySelectorAll(".xr-fx")).toHaveLength(state === "fractured" ? 1 : 0);
            if (state === "fractured") {
              expect(wrap.querySelector(".xr-fx")?.getAttribute("data-fresh")).toBe("false");
            }
          }
          unmount();
          restoreMatchMedia();
        },
      ),
      { numRuns: 25 },
    );
  });

  it("adds no shake class when a version change fractures more bones", () => {
    installMatchMedia(false);
    const anatomy = signatureAnatomy();
    const clean: Trace = { ...signatureTrace(), ruleOutcomes: signatureTrace().ruleOutcomes.map((o) => ({ ...o, conditionMet: false })) };
    const { container, rerender } = render(shell(clean, anatomy, true, "v1"));
    rerender(shell(signatureTrace(), anatomy, true, "v2"));
    expect(container.querySelector(".xr-lightbox")).not.toBeNull();
    expect(container.querySelector(".xr-shake-a, .xr-shake-b")).toBeNull();
    // data-fresh only flags a remount; without .xr-live no animation CSS matches it.
    expect(container.querySelector(".xr-hotspot-wrap > .xr-fx")).not.toBeNull();
    expect(container.querySelector(".xr-live")).toBeNull();
  });

  it("applies a changed prop or media query on the next render", () => {
    installMatchMedia(false);
    const anatomy = signatureAnatomy();
    const trace = signatureTrace();
    const root = (c: HTMLElement) => c.querySelector(".xr-shell") as HTMLElement;
    const { container, rerender } = render(shell(trace, anatomy, undefined));
    expect(root(container).dataset.motion).toBe("auto");
    expect(root(container).classList.contains("xr-live")).toBe(true);

    act(() => dispatchMatchMediaChange(true));
    expect(root(container).classList.contains("xr-live")).toBe(false);
    expect(root(container).dataset.intro).toBe("done");

    rerender(shell(trace, anatomy, false));
    expect(root(container).dataset.motion).toBe("full");
    expect(root(container).classList.contains("xr-live")).toBe(true);

    rerender(shell(trace, anatomy, true));
    expect(root(container).dataset.motion).toBe("reduce");
    expect(root(container).classList.contains("xr-live")).toBe(false);

    act(() => dispatchMatchMediaChange(false));
    rerender(shell(trace, anatomy, undefined));
    expect(root(container).dataset.motion).toBe("auto");
    expect(root(container).classList.contains("xr-live")).toBe(true);
  });
});
