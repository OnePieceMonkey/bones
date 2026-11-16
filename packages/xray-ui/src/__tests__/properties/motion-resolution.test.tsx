// Feature: visual-polish, Property 12: Reduced-motion resolution
import { afterEach, describe, it, expect } from "vitest";
import fc from "fast-check";
import { cleanup, render } from "@testing-library/react";
import { ShellFrame } from "../../components/shell/ShellFrame";
import { installMatchMedia, restoreMatchMedia } from "../helpers/matchMedia";

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
