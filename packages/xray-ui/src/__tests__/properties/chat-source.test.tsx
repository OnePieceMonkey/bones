// Feature: xray-ui, Property 3: Chat text comes only from the builder and fixed templates
import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { cleanup, render } from "@testing-library/react";
import type { RuleOutcome } from "@bones/core";
import { DrBonesChat } from "../../components/DrBonesChat";
import { TEMPLATES, buildChatMessages } from "../../model/chat";
import { arbTraceAndAnatomy } from "../helpers/arbitraries";
import { installNetSpy } from "../helpers/netSpy";

const RESULT_LABELS: Record<string, string> = {
  approved: "APPROVED",
  partially_approved: "PARTIALLY APPROVED",
  rejected: "REJECTED",
};

/** Independent restatement of the fracture rule from raw outcome fields. */
function isHit(o: RuleOutcome): boolean {
  if (o.conditionMet !== true) return false;
  if (o.effect === "blocking") return true;
  return (
    o.amountBeforeCents !== undefined &&
    o.amountAfterCents !== undefined &&
    o.amountAfterCents < o.amountBeforeCents
  );
}

describe("Property 3: chat text source", () => {
  it("chat DOM text equals builder output, which equals fixed templates applied to trace values", () => {
    const spy = installNetSpy();
    try {
      fc.assert(
        fc.property(arbTraceAndAnatomy, ({ trace, anatomy }) => {
          // Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.12, 14.1, 18.4, 18.5
          const messages = buildChatMessages(trace, anatomy);
          expect(buildChatMessages(trace, anatomy)).toEqual(messages);

          const labelOf = new Map(anatomy.bones.map((b) => [b.ruleId, b.label] as const));
          const mappedOutcomes = trace.ruleOutcomes.filter((o) => labelOf.has(o.ruleId));
          const hits = mappedOutcomes.filter(isHit);
          const healthy = mappedOutcomes.length - hits.length;

          const fractureTexts = hits.map((o) => {
            const evidence = Object.entries(o.evidence)
              .slice(0, 2)
              .map(([path, value]) => {
                const label = Object.prototype.hasOwnProperty.call(anatomy.fieldLabels, path)
                  ? (anatomy.fieldLabels[path] as string)
                  : path;
                return TEMPLATES.evidenceLine(label, String(value));
              });
            return [
              TEMPLATES.fractureHead(labelOf.get(o.ruleId) as string),
              TEMPLATES.fractureRule(o.ruleId, o.ruleVersion, o.renderedMessage),
              ...evidence,
            ].join("\n");
          });
          const expected = [
            TEMPLATES.greeting(),
            ...fractureTexts,
            TEMPLATES.summary(healthy),
            TEMPLATES.result(RESULT_LABELS[trace.result] as string, String(trace.amountCents)),
          ];
          expect(messages.map((m) => m.text)).toEqual(expected);

          const onMessagesComplete = vi.fn();
          const { container } = render(
            <DrBonesChat
              trace={trace}
              anatomy={anatomy}
              reducedMotion
              onMessagesComplete={onMessagesComplete}
            />,
          );
          const domTexts = [...container.querySelectorAll(".xr-bubble")].map((el) => el.textContent);
          cleanup();
          expect(domTexts).toEqual(expected);
          expect(onMessagesComplete).toHaveBeenCalledTimes(1);
          expect(spy.calls).toEqual([]);
        }),
        { numRuns: 100 },
      );
    } finally {
      spy.restore();
    }
  });
});
