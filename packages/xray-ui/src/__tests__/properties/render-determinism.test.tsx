// Feature: xray-ui, Property 2: Render determinism
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { cleanup, render } from "@testing-library/react";
import { XrayView } from "../../components/XrayView";
import { arbFilmSource, arbTraceAndAnatomy } from "../helpers/arbitraries";

describe("Property 2: render determinism", () => {
  it("two fresh mounts of the same inputs produce identical markup", () => {
    fc.assert(
      fc.property(arbTraceAndAnatomy, arbFilmSource, fc.boolean(), ({ trace, anatomy }, source, xray) => {
        // Validates: Requirements 10.1, 10.4, 18.3
        const mount = (): string => {
          const { container } = render(
            <XrayView
              trace={trace}
              anatomy={anatomy}
              source={source}
              versions={["v1", "v2", "v3"]}
              version="v1"
              onVersionChange={() => {}}
              xray={xray}
              reducedMotion
            />,
          );
          const html = container.innerHTML;
          cleanup();
          return html;
        };
        const first = mount();
        const second = mount();
        expect(second).toBe(first);
      }),
      { numRuns: 100 },
    );
  });
});
