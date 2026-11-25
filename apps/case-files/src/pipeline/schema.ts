import { z } from "zod";

/**
 * Case_Schema. Every object is strict. The 32,768-byte cap is not checked here;
 * the pipeline does it on the raw string before parsing.
 */

const ID = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
const MIN = z.number().int().min(0).max(1439);
const TEXT = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((s) => s.trim().length > 0, "must not be only whitespace")
    .refine((s) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s), "must not contain control characters");
const NAME = (max: number) => TEXT(max);

const Victim = z.object({ name: NAME(40) }).strict();
const Place = z.object({ id: ID, name: NAME(60) }).strict();
const Item = z.object({ id: ID, name: NAME(60) }).strict();
const Crime = z
  .object({ placeId: ID, startMin: MIN, endMin: MIN, weaponItemId: ID })
  .strict()
  .refine((c) => c.startMin <= c.endMin, { message: "startMin must be <= endMin", path: ["endMin"] });

const LocationStatement = z
  .object({ id: ID, kind: z.literal("location"), text: TEXT(160), placeId: ID, startMin: MIN, endMin: MIN })
  .strict();
const PossessionStatement = z
  .object({ id: ID, kind: z.literal("possession"), text: TEXT(160), itemId: ID, held: z.boolean() })
  .strict();
const SightingStatement = z
  .object({
    id: ID,
    kind: z.literal("sighting"),
    text: TEXT(160),
    seenSuspectId: ID,
    placeId: ID,
    startMin: MIN,
    endMin: MIN,
  })
  .strict();
const StatementSchema = z.discriminatedUnion("kind", [LocationStatement, PossessionStatement, SightingStatement]);

const SuspectSchema = z
  .object({ id: ID, name: NAME(40), statements: z.array(StatementSchema).min(1).max(5) })
  .strict();

const Reliability = z.enum(["firm", "weak"]);
const PresenceClue = z
  .object({
    id: ID,
    kind: z.literal("presence"),
    text: TEXT(120),
    reliability: Reliability,
    suspectId: ID,
    placeId: ID,
    startMin: MIN,
    endMin: MIN,
  })
  .strict();
const HoldingClue = z
  .object({
    id: ID,
    kind: z.literal("holding"),
    text: TEXT(120),
    reliability: Reliability,
    suspectId: ID,
    itemId: ID,
  })
  .strict();
const MotiveClue = z
  .object({ id: ID, kind: z.literal("motive"), text: TEXT(120), reliability: Reliability, suspectId: ID })
  .strict();
const ClueSchema = z.discriminatedUnion("kind", [PresenceClue, HoldingClue, MotiveClue]);

const caseShape = z
  .object({
    title: TEXT(60),
    setting: TEXT(240),
    victim: Victim,
    crime: Crime,
    places: z.array(Place).min(2).max(6),
    items: z.array(Item).min(1).max(6),
    suspects: z.array(SuspectSchema).min(2).max(4),
    clues: z.array(ClueSchema).min(1).max(16),
  })
  .strict();

type CaseShape = z.infer<typeof caseShape>;

/** Unique ids and cross-references. Issues carry the path of the offending field. */
function checkReferences(c: CaseShape, ctx: z.RefinementCtx): void {
  const issue = (path: (string | number)[], message: string): void => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
  };
  const unique = (ids: { id: string }[], base: (string | number)[]): Set<string> => {
    const seen = new Set<string>();
    ids.forEach((e, i) => {
      if (seen.has(e.id)) issue([...base, i, "id"], `duplicate id "${e.id}"`);
      seen.add(e.id);
    });
    return seen;
  };
  const order = (start: number, end: number, path: (string | number)[]): void => {
    if (start > end) issue(path, "startMin must be <= endMin");
  };
  const places = unique(c.places, ["places"]);
  const items = unique(c.items, ["items"]);
  const suspects = unique(c.suspects, ["suspects"]);
  const statementIds = new Set<string>();
  c.suspects.forEach((s, i) =>
    s.statements.forEach((st, j) => {
      if (statementIds.has(st.id)) issue(["suspects", i, "statements", j, "id"], `duplicate id "${st.id}"`);
      statementIds.add(st.id);
    }),
  );
  unique(c.clues, ["clues"]);

  const need = (set: Set<string>, id: string, path: (string | number)[], what: string): void => {
    if (!set.has(id)) issue(path, `unknown ${what} "${id}"`);
  };
  need(places, c.crime.placeId, ["crime", "placeId"], "place");
  need(items, c.crime.weaponItemId, ["crime", "weaponItemId"], "item");
  c.suspects.forEach((s, i) =>
    s.statements.forEach((st, j) => {
      const base = ["suspects", i, "statements", j];
      if (st.kind !== "possession") order(st.startMin, st.endMin, [...base, "endMin"]);
      if (st.kind === "location") need(places, st.placeId, [...base, "placeId"], "place");
      else if (st.kind === "possession") need(items, st.itemId, [...base, "itemId"], "item");
      else {
        need(places, st.placeId, [...base, "placeId"], "place");
        need(suspects, st.seenSuspectId, [...base, "seenSuspectId"], "suspect");
        if (st.seenSuspectId === s.id) issue([...base, "seenSuspectId"], "a suspect cannot see themselves");
      }
    }),
  );
  c.clues.forEach((cl, k) => {
    const base = ["clues", k];
    need(suspects, cl.suspectId, [...base, "suspectId"], "suspect");
    if (cl.kind === "presence") {
      order(cl.startMin, cl.endMin, [...base, "endMin"]);
      need(places, cl.placeId, [...base, "placeId"], "place");
    }
    else if (cl.kind === "holding") need(items, cl.itemId, [...base, "itemId"], "item");
  });
}

export const caseFieldsSchema = caseShape.superRefine(checkReferences);

export const confidenceSchema = z.record(z.string(), z.number().min(0).max(1));

export const modelOutputSchema = caseShape
  .extend({ confidence: confidenceSchema })
  .strict()
  .superRefine(checkReferences);

export type CaseFields = z.infer<typeof caseFieldsSchema>;
export type Suspect = CaseFields["suspects"][number];
export type Statement = Suspect["statements"][number];
export type Clue = CaseFields["clues"][number];
export type ModelOutput = z.infer<typeof modelOutputSchema>;

/** Drops `confidence` from validated model output and returns the case fields. */
export function extractCaseFields(validated: Record<string, unknown>): CaseFields {
  const { confidence: _confidence, ...fields } = validated;
  return fields as CaseFields;
}
