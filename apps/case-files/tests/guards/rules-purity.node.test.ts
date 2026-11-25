import { isCoreError, parseRule } from "@bones/core";
import { describe, expect, it } from "vitest";
import { readRuleDir } from "../helpers/fixtures";

const ID_PATTERN = /^(proof-(means|opportunity|motive)|statement-(location|possession|sighting)-contradicted)$/;
const ALLOWED_KEYS = ["condition", "effect", "effectConfig", "id", "messageTemplate", "version"];

/** Returns the list of purity violations of one raw rule file. Empty means clean. */
export function purityViolations(raw: unknown): string[] {
  const out: string[] = [];
  const parsed = parseRule(raw);
  if (isCoreError(parsed)) return ["does not parse with core parseRule"];
  const obj = raw as Record<string, unknown>;
  for (const k of Object.keys(obj)) if (!ALLOWED_KEYS.includes(k)) out.push(`unknown key ${k}`);
  if (parsed.effect !== "deducting") out.push("effect is not deducting");
  if (parsed.condition.kind !== "comparison") {
    out.push("condition is not a comparison");
  } else if (parsed.condition.left.kind !== "path" || parsed.condition.left.segments[0] !== "subject") {
    out.push("left path does not start with subject");
  }
  const cfg = parsed.effectConfig as { deductionAmount?: unknown };
  if (cfg.deductionAmount !== 1) out.push("deductionAmount is not 1");
  if (parsed.messageTemplate.length > 240) out.push("messageTemplate longer than 240");
  for (const m of parsed.messageTemplate.matchAll(/\{\{([^}]*)\}\}/g)) {
    if (!(m[1] ?? "").trim().startsWith("subject.")) out.push(`slot ${m[1]} does not start with subject.`);
  }
  if (!ID_PATTERN.test(parsed.id)) out.push(`rule id ${parsed.id} outside the known patterns`);
  return out;
}

const clean = {
  id: "proof-means",
  version: "1.0.0",
  effect: "deducting",
  condition: {
    kind: "comparison",
    left: { kind: "path", segments: ["subject", "meansAny"] },
    op: ">=",
    right: { kind: "literal", value: 1 },
  },
  effectConfig: { deductionAmount: 1, scope: "proof" },
  messageTemplate: "{{subject.name}} holds a clue.",
};

describe("rules purity guard", () => {
  it("self-test: a clean sample has no violations", () => {
    expect(purityViolations(clean)).toEqual([]);
  });

  it("self-test: a bad sample is caught", () => {
    const bad = {
      ...clean,
      id: "proof-hunch",
      effect: "blocking",
      messageTemplate: "{{other.name}}",
      effectConfig: { deductionAmount: 2, scope: "proof" },
    };
    const v = purityViolations(bad);
    expect(v.length).toBeGreaterThanOrEqual(4);
  });

  it("every case-files rule file is pure", () => {
    for (const [name, raw] of Object.entries(readRuleDir("rules"))) {
      expect(purityViolations(raw), name).toEqual([]);
    }
  });
});
