import { afterEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import { cleanup, render } from "@testing-library/react";
import { Shell } from "../../components/shell/Shell";
import type { Anatomy, FilmSource, Trace } from "../../types";
import { arbFilmSource, arbTraceAndAnatomy } from "../helpers/arbitraries";

afterEach(cleanup);

function shell(trace: Trace, anatomy: Anatomy, source: FilmSource, xray: boolean) {
  return (
    <Shell
      trace={trace}
      anatomy={anatomy}
      source={source}
      heading="Audit"
      lightboxLabel="Viewer"
      versions={["v1", "v2", "v3"]}
      version="v1"
      onVersionChange={() => {}}
      xray={xray}
      onXrayChange={() => {}}
      introKey="case-1"
      claimedCents={10_000}
      reducedMotion
    />
  );
}

describe("Shell images and determinism", () => {
  // Feature: visual-polish, Property 20: Images are declared, sized and described
  it("Property 20: every img has no loading attribute, positive integer size and alt text or is decorative", () => {
    fc.assert(
      fc.property(arbTraceAndAnatomy, arbFilmSource, ({ trace, anatomy }, source) => {
        // Validates: Requirements 1.6, 17.3, 22.4
        const { container } = render(shell(trace, anatomy, source, true));
        const imgs = Array.from(container.querySelectorAll("img"));
        for (const img of imgs) {
          expect(img.hasAttribute("loading")).toBe(false);
          for (const attr of ["width", "height"] as const) {
            const raw = img.getAttribute(attr);
            expect(raw).not.toBeNull();
            const n = Number(raw);
            expect(Number.isInteger(n) && n > 0).toBe(true);
          }
          const alt = img.getAttribute("alt");
          const decorative = alt === "" && img.getAttribute("aria-hidden") === "true";
          expect(decorative || (alt !== null && alt.length > 0)).toBe(true);
        }
        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  // Feature: visual-polish, Property 21: Render determinism
  it("Property 21: two fresh mounts of the same inputs produce identical markup", () => {
    fc.assert(
      fc.property(arbTraceAndAnatomy, arbFilmSource, fc.boolean(), ({ trace, anatomy }, source, xray) => {
        // Validates: Requirements 20.4
        const mount = (): string => {
          const { container } = render(shell(trace, anatomy, source, xray));
          const html = container.innerHTML;
          cleanup();
          return html;
        };
        expect(mount()).toBe(mount());
      }),
      { numRuns: 100 },
    );
  });
});
