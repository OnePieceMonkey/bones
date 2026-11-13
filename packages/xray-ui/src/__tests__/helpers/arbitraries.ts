import fc from "fast-check";
import type {
  DecisionResult,
  RuleEffect,
  RuleOutcome,
  SourceLocation,
  Trace,
} from "@bones/core";
import { REGIONS } from "../../types";
import type { Anatomy, FilmSource, Region } from "../../types";

export const arbRuleId: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,15}$/)
  .filter((s) => s.length > 0);

export const arbRegion: fc.Arbitrary<Region> = fc.constantFrom(...REGIONS);

export const arbEffect: fc.Arbitrary<RuleEffect> = fc.constantFrom<RuleEffect>(
  "blocking",
  "capping",
  "deducting",
);

const arbPath = fc.stringMatching(/^[a-z]{1,6}(\.[a-z]{1,6}){0,2}$/);

export const arbEvidence: fc.Arbitrary<Record<string, unknown>> = fc.dictionary(
  arbPath,
  fc.oneof(
    fc.string({ maxLength: 20 }),
    fc.integer({ min: 0, max: 1_000_000 }),
    fc.boolean(),
  ),
  { maxKeys: 4 },
);

const arbCents = fc.integer({ min: 0, max: 1_000_000 });

const arbAmounts: fc.Arbitrary<{ before: number; after: number } | null> = fc.oneof(
  fc.constant(null),
  arbCents.map((n) => ({ before: n, after: n })),
  fc
    .tuple(arbCents, arbCents)
    .map(([a, b]) => ({ before: Math.max(a, b), after: Math.min(a, b) }))
    .filter((p) => p.after < p.before),
);

/** Outcome generator; pass `ruleId` to pin the id, otherwise one is generated. */
export function arbOutcome(ruleId?: string): fc.Arbitrary<RuleOutcome> {
  return fc
    .record({
      id: ruleId === undefined ? arbRuleId : fc.constant(ruleId),
      effect: arbEffect,
      conditionMet: fc.boolean(),
      evidence: arbEvidence,
      message: fc.string({ maxLength: 60 }),
      amounts: arbAmounts,
      version: fc.constantFrom("1.0.0", "2.0.0", "3.0.0"),
    })
    .map(({ id, effect, conditionMet, evidence, message, amounts, version }) => {
      const base: RuleOutcome = {
        ruleId: id,
        ruleVersion: version,
        effect,
        conditionMet,
        evidence,
        renderedMessage: message,
      };
      if (effect === "blocking" || amounts === null) return base;
      const withAmounts: RuleOutcome = {
        ...base,
        amountBeforeCents: amounts.before,
        amountAfterCents: amounts.after,
      };
      return effect === "capping"
        ? { ...withAmounts, appliedCapCents: amounts.after }
        : { ...withAmounts, deductedCents: amounts.before - amounts.after };
    });
}

export const arbFilmSource: fc.Arbitrary<FilmSource> = fc.oneof(
  fc.string({ maxLength: 200 }).map((text): FilmSource => ({ kind: "text", text })),
  fc
    .record({ src: fc.constantFrom("a.png", "b.png"), alt: fc.string({ maxLength: 20 }) })
    .map(({ src, alt }): FilmSource => ({ kind: "image", src, alt })),
);

const arbSource: fc.Arbitrary<SourceLocation | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.nat(50).map((lineIndex): SourceLocation => ({ kind: "line", lineIndex })),
  fc
    .record({
      x: fc.nat(500),
      y: fc.nat(500),
      width: fc.integer({ min: 1, max: 300 }),
      height: fc.integer({ min: 1, max: 100 }),
    })
    .map((b): SourceLocation => ({ kind: "bbox", ...b })),
);

const arbResult: fc.Arbitrary<DecisionResult> = fc.constantFrom<DecisionResult>(
  "approved",
  "partially_approved",
  "rejected",
);

const FIELD_PATHS = ["receipt.merchant", "receipt.date", "receipt.total", "claim.reason"];

export const arbTraceAndAnatomy: fc.Arbitrary<{ trace: Trace; anatomy: Anatomy }> = fc
  .record({
    ids: fc.uniqueArray(arbRuleId, { minLength: 1, maxLength: 8 }),
    mappedMask: fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
    extraBones: fc.uniqueArray(arbRuleId, { maxLength: 2 }),
    regions: fc.array(arbRegion, { minLength: 10, maxLength: 10 }),
    result: arbResult,
    amountCents: arbCents,
    fieldIndexes: fc.uniqueArray(fc.integer({ min: 0, max: FIELD_PATHS.length - 1 }), {
      maxLength: FIELD_PATHS.length,
    }),
    confidences: fc.array(fc.double({ min: 0, max: 1, noNaN: true }), {
      minLength: 4,
      maxLength: 4,
    }),
    sources: fc.array(arbSource, { minLength: 4, maxLength: 4 }),
  })
  .chain((p) =>
    fc
      .tuple(...p.ids.map((id) => arbOutcome(id)))
      .map((outcomes) => ({ p, outcomes })),
  )
  .map(({ p, outcomes }) => {
    const mapped = p.ids.filter((_, i) => p.mappedMask[i] === true);
    const extras = p.extraBones.filter((id) => !p.ids.includes(id));
    const boneIds = [...mapped, ...extras];
    const anatomy: Anatomy = {
      bones: boneIds.map((ruleId, i) => ({
        ruleId,
        label: `Bone ${ruleId}`,
        region: p.regions[i] ?? "spine",
      })),
      fieldLabels: Object.fromEntries(FIELD_PATHS.map((f) => [f, `Label ${f}`])),
    };
    const paths = p.fieldIndexes.map((i) => FIELD_PATHS[i] as string);
    const confidence: Record<string, number> = {};
    const sources: Record<string, SourceLocation | undefined> = {};
    const validatedFields: Record<string, unknown> = {};
    paths.forEach((path, i) => {
      confidence[path] = p.confidences[i % 4] as number;
      sources[path] = p.sources[i % 4];
      validatedFields[path] = `value-${i}`;
    });
    const trace: Trace = {
      traceSchemaVersion: "1",
      decisionId: "decision-arb",
      createdAt: "2024-01-01T00:00:00.000Z",
      inputHash: "0".repeat(64),
      rawModelOutput: "{}",
      proposedFields: { ...validatedFields },
      confidence,
      sources,
      validatedFields,
      ruleSetId: "arb",
      ruleSetVersion: "1.0.0",
      ruleOutcomes: outcomes,
      result: p.result,
      amountCents: p.amountCents,
    };
    return { trace, anatomy };
  });
