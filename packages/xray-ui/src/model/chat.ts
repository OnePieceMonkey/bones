import type { Anatomy, ChatMessage, Trace } from "../types";
import { resultLabel, safeFormat } from "./format";
import { countPassed, evidenceRows, selectBones } from "./selectors";

/**
 * Closed set of Dr. Bones templates. Every string literal used to build chat
 * messages (text, ids, kinds, line separator) lives here.
 */
export const TEMPLATES = {
  greeting: () => "Let's take a look at this decision.",
  fractureHead: (label: string) => `I see a fracture in the ${label} bone.`,
  fractureRule: (ruleId: string, ruleVersion: string, renderedMessage: string) =>
    `Rule ${ruleId} v${ruleVersion}: ${renderedMessage}`,
  evidenceLine: (fieldLabel: string, value: string) => `${fieldLabel}: ${value}`,
  summary: (n: number) =>
    n === 0
      ? "No other bones look healthy."
      : n === 1
        ? "1 other bone looks healthy."
        : `${n} other bones look healthy.`,
  result: (resultLabel: string, formattedAmount: string) =>
    `Result: ${resultLabel}. Amount: ${formattedAmount}.`,
  // Structural helpers (ids, kinds, separator): not user-facing prose.
  joinLines: (lines: readonly string[]) => lines.join("\n"),
  id: {
    greeting: () => "greeting",
    fracture: (j: number) => `fracture-${j}`,
    summary: () => "summary",
    result: () => "result",
  },
  kind: {
    greeting: () => "greeting" as const,
    fracture: () => "fracture" as const,
    summary: () => "summary" as const,
    result: () => "result" as const,
  },
} as const;

export const MAX_EVIDENCE_LINES = 2;

export function buildChatMessages(trace: Trace, anatomy: Anatomy): ChatMessage[] {
  const bones = selectBones(trace, anatomy);
  const format = safeFormat(anatomy);

  const messages: ChatMessage[] = [
    { id: TEMPLATES.id.greeting(), kind: TEMPLATES.kind.greeting(), text: TEMPLATES.greeting() },
  ];

  // Fractured bones keyed by their (first) outcome, so we can walk trace order.
  const byOutcome = new Map(
    bones.filter((b) => b.state === "fractured" && b.outcome).map((b) => [b.outcome, b] as const),
  );
  const seen = new Set<string>();
  let j = 0;
  for (const outcome of trace.ruleOutcomes) {
    if (seen.has(outcome.ruleId)) continue;
    seen.add(outcome.ruleId);
    const bone = byOutcome.get(outcome);
    if (!bone) continue;
    const lines = [
      TEMPLATES.fractureHead(bone.label),
      TEMPLATES.fractureRule(outcome.ruleId, outcome.ruleVersion, outcome.renderedMessage),
      ...evidenceRows(outcome, anatomy)
        .slice(0, MAX_EVIDENCE_LINES)
        .map((row) => TEMPLATES.evidenceLine(row.label, row.value)),
    ];
    messages.push({
      id: TEMPLATES.id.fracture(j),
      kind: TEMPLATES.kind.fracture(),
      text: TEMPLATES.joinLines(lines),
    });
    j += 1;
  }

  messages.push({
    id: TEMPLATES.id.summary(),
    kind: TEMPLATES.kind.summary(),
    text: TEMPLATES.summary(countPassed(bones)),
  });
  messages.push({
    id: TEMPLATES.id.result(),
    kind: TEMPLATES.kind.result(),
    text: TEMPLATES.result(resultLabel(trace.result), format("amountCents", trace.amountCents)),
  });
  return messages;
}
