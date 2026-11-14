// Feature: xray-ui, Property 4: Reduced motion removes all animation and shows full text
import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { cleanup, render } from "@testing-library/react";
import { XrayView } from "../../components/XrayView";
import { buildChatMessages } from "../../model/chat";
import { arbFilmSource, arbTraceAndAnatomy } from "../helpers/arbitraries";

describe("Property 4: reduced motion", () => {
  it("has no anim- class, no typing dots, full chat text, completion callback and icon plus text on every bone", () => {
    fc.assert(
      fc.property(arbTraceAndAnatomy, arbFilmSource, ({ trace, anatomy }, source) => {
        // Validates: Requirements 11.3, 11.4, 11.5, 11.6, 6.7, 18.6
        const onMessagesComplete = vi.fn();
        const { container } = render(
          <XrayView
            trace={trace}
            anatomy={anatomy}
            source={source}
            versions={["v1", "v2", "v3"]}
            version="v1"
            onVersionChange={() => {}}
            xray
            reducedMotion
            onMessagesComplete={onMessagesComplete}
          />,
        );

        const animated = [...container.querySelectorAll("*")].filter((el) =>
          /(^|\s)anim-/.test(el.getAttribute("class") ?? ""),
        );
        expect(animated).toHaveLength(0);
        expect(container.querySelector(".xr-typing-dots")).toBeNull();

        const bubbles = [...container.querySelectorAll(".xr-bubble")].map((el) => el.textContent);
        expect(bubbles).toEqual(buildChatMessages(trace, anatomy).map((m) => m.text));
        expect(onMessagesComplete).toHaveBeenCalledTimes(1);

        const buttons = [...container.querySelectorAll("button.xr-bone-btn")];
        expect(buttons).toHaveLength(anatomy.bones.length);
        for (const b of buttons) {
          expect((b.querySelector(".xr-bone-cue")?.textContent ?? "").length).toBeGreaterThan(0);
          expect((b.querySelector(".xr-bone-state")?.textContent ?? "").length).toBeGreaterThan(0);
        }
        cleanup();
      }),
      { numRuns: 100 },
    );
  });
});
