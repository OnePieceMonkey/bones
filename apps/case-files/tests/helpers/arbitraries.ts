import fc from "fast-check";
import type { CaseFields } from "../../src/pipeline/schema";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const TEXT_CHARS = [...`${LETTERS} .,'-`];

/** Non-empty after trim, no control characters, length between 1 and max. */
export const textArb = (max: number): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.constantFrom(...LETTERS),
      fc.array(fc.constantFrom(...TEXT_CHARS), { minLength: 0, maxLength: Math.min(max - 1, 24) }),
    )
    .map(([first, rest]) => first + rest.join(""));

export type IntervalRelation = "before" | "touching-before" | "inside" | "touching-after" | "after" | "spanning";
const RELATIONS: IntervalRelation[] = ["before", "touching-before", "inside", "touching-after", "after", "spanning"];

const intervalSeedArb = fc.record({
  rel: fc.constantFrom(...RELATIONS),
  a: fc.integer({ min: 0, max: 30 }),
  b: fc.integer({ min: 0, max: 100 }),
});
type IntervalSeed = { rel: IntervalRelation; a: number; b: number };

/** Interval relative to the crime window [cs, ce]; always 0 <= start <= end <= 1439. */
function intervalFor(seed: IntervalSeed, cs: number, ce: number): { startMin: number; endMin: number } {
  const { rel, a, b } = seed;
  switch (rel) {
    case "before": {
      const endMin = cs - 1 - a;
      return { startMin: Math.max(0, endMin - b), endMin };
    }
    case "touching-before":
      return { startMin: Math.max(0, cs - b), endMin: cs };
    case "inside": {
      const startMin = Math.min(ce, cs + a);
      return { startMin, endMin: Math.min(ce, startMin + b) };
    }
    case "touching-after":
      return { startMin: ce, endMin: ce + b };
    case "after": {
      const startMin = ce + 1 + a;
      return { startMin, endMin: startMin + b };
    }
    case "spanning":
      return { startMin: cs - a, endMin: ce + b };
  }
}

const stmtSeedArb = fc.record({
  kind: fc.constantFrom("location", "possession", "sighting"),
  text: textArb(160),
  p: fc.nat(1000),
  i: fc.nat(1000),
  s: fc.nat(1000),
  held: fc.boolean(),
  iv: intervalSeedArb,
});
const clueSeedArb = fc.record({
  kind: fc.constantFrom("presence", "holding", "motive"),
  text: textArb(120),
  reliability: fc.constantFrom<"firm" | "weak">("firm", "weak"),
  p: fc.nat(1000),
  i: fc.nat(1000),
  s: fc.nat(1000),
  iv: intervalSeedArb,
});

/** Valid Case: 2 to 4 suspects, 1 to 5 statements each, all kinds, ids unique by construction. */
export const validCaseArb: fc.Arbitrary<CaseFields> = fc
  .record({
    nPlaces: fc.integer({ min: 2, max: 6 }),
    nItems: fc.integer({ min: 1, max: 6 }),
    nSuspects: fc.integer({ min: 2, max: 4 }),
    cs: fc.integer({ min: 60, max: 1150 }),
    len: fc.integer({ min: 0, max: 120 }),
    crimeP: fc.nat(1000),
    crimeI: fc.nat(1000),
  })
  .chain((c) =>
    fc.record({
      c: fc.constant(c),
      title: textArb(60),
      setting: textArb(240),
      victim: textArb(40),
      placeNames: fc.uniqueArray(textArb(60), { minLength: c.nPlaces, maxLength: c.nPlaces }),
      itemNames: fc.uniqueArray(textArb(60), { minLength: c.nItems, maxLength: c.nItems }),
      suspectNames: fc.uniqueArray(textArb(40), { minLength: c.nSuspects, maxLength: c.nSuspects }),
      statements: fc.array(fc.array(stmtSeedArb, { minLength: 1, maxLength: 5 }), {
        minLength: c.nSuspects,
        maxLength: c.nSuspects,
      }),
      clues: fc.array(clueSeedArb, { minLength: 1, maxLength: 16 }),
    }),
  )
  .map(({ c, title, setting, victim, placeNames, itemNames, suspectNames, statements, clues }) => {
    const placeIds = placeNames.map((_, k) => `place-${k}`);
    const itemIds = itemNames.map((_, k) => `item-${k}`);
    const suspectIds = suspectNames.map((_, k) => `sus-${k}`);
    const ce = c.cs + c.len;
    const pick = (ids: string[], n: number): string => ids[n % ids.length] as string;
    const result: CaseFields = {
      title,
      setting,
      victim: { name: victim },
      crime: {
        placeId: pick(placeIds, c.crimeP),
        startMin: c.cs,
        endMin: ce,
        weaponItemId: pick(itemIds, c.crimeI),
      },
      places: placeNames.map((name, k) => ({ id: placeIds[k] as string, name })),
      items: itemNames.map((name, k) => ({ id: itemIds[k] as string, name })),
      suspects: suspectNames.map((name, si) => ({
        id: suspectIds[si] as string,
        name,
        statements: (statements[si] ?? []).map((seed, j) => {
          const id = `st-${si}-${j}`;
          const iv = intervalFor(seed.iv, c.cs, ce);
          if (seed.kind === "location") {
            return { id, kind: "location" as const, text: seed.text, placeId: pick(placeIds, seed.p), ...iv };
          }
          if (seed.kind === "possession") {
            return { id, kind: "possession" as const, text: seed.text, itemId: pick(itemIds, seed.i), held: seed.held };
          }
          // never the author: pick among the other suspects
          const others = suspectIds.filter((_, k) => k !== si);
          return {
            id,
            kind: "sighting" as const,
            text: seed.text,
            seenSuspectId: pick(others, seed.s),
            placeId: pick(placeIds, seed.p),
            ...iv,
          };
        }),
      })),
      clues: clues.map((seed, k) => {
        const base = { id: `cl-${k}`, text: seed.text, reliability: seed.reliability, suspectId: pick(suspectIds, seed.s) };
        if (seed.kind === "presence") {
          return {
            ...base,
            kind: "presence" as const,
            placeId: pick(placeIds, seed.p),
            ...intervalFor(seed.iv, c.cs, ce),
          };
        }
        if (seed.kind === "holding") return { ...base, kind: "holding" as const, itemId: pick(itemIds, seed.i) };
        return { ...base, kind: "motive" as const };
      }),
    };
    return result;
  });

/** Confidence map with the keys of requirement 2.12 for the given case. */
export function confidenceArb(c: CaseFields): fc.Arbitrary<Record<string, number>> {
  const keys = ["title", "setting", "victim", "crime"];
  c.suspects.forEach((s, i) => s.statements.forEach((_, j) => keys.push(`suspects.${i}.statements.${j}`)));
  c.clues.forEach((_, k) => keys.push(`clues.${k}`));
  return fc
    .array(fc.integer({ min: 0, max: 1000 }), { minLength: keys.length, maxLength: keys.length })
    .map((ns) => Object.fromEntries(keys.map((key, n) => [key, (ns[n] as number) / 1000])));
}

export const validModelOutputArb: fc.Arbitrary<CaseFields & { confidence: Record<string, number> }> =
  validCaseArb.chain((c) => confidenceArb(c).map((confidence) => ({ ...c, confidence })));

export type MutationKind =
  | "title-too-long"
  | "text-too-long"
  | "text-whitespace"
  | "minute-range"
  | "id-pattern"
  | "duplicate-place-id"
  | "duplicate-suspect-id"
  | "duplicate-statement-id"
  | "unknown-crime-place"
  | "unknown-clue-suspect"
  | "unknown-statement-ref"
  | "start-after-end"
  | "self-sighting"
  | "unknown-key"
  | "forbidden-key";

export const MUTATION_KINDS: MutationKind[] = [
  "title-too-long",
  "text-too-long",
  "text-whitespace",
  "minute-range",
  "id-pattern",
  "duplicate-place-id",
  "duplicate-suspect-id",
  "duplicate-statement-id",
  "unknown-crime-place",
  "unknown-clue-suspect",
  "unknown-statement-ref",
  "start-after-end",
  "self-sighting",
  "unknown-key",
  "forbidden-key",
];

export interface Mutation {
  kind: MutationKind;
  /** The mutated model output (case fields plus confidence). */
  output: Record<string, unknown>;
  /** Dot path at which validation must report an issue. */
  path: string;
}

/** Applies exactly one limit violation to a valid model output. */
export function mutate(
  valid: CaseFields & { confidence: Record<string, number> },
  kind: MutationKind,
  pickA: number,
  pickB: number,
): Mutation {
  const o = structuredClone(valid) as CaseFields & { confidence: Record<string, number> } & Record<string, unknown>;
  const si = pickA % o.suspects.length;
  const suspect = o.suspects[si]!;
  const j = pickB % suspect.statements.length;
  const st = suspect.statements[j]!;
  const k = pickB % o.clues.length;
  const done = (path: string): Mutation => ({ kind, output: o, path });
  switch (kind) {
    case "title-too-long":
      o.title = "x".repeat(61);
      return done("title");
    case "text-too-long":
      st.text = "x".repeat(161);
      return done(`suspects.${si}.statements.${j}.text`);
    case "text-whitespace":
      o.clues[k]!.text = "   ";
      return done(`clues.${k}.text`);
    case "minute-range": {
      const bad = [1440, -1, 1.5][pickA % 3] as number;
      o.crime.startMin = bad;
      return done("crime.startMin");
    }
    case "id-pattern": {
      const idx = pickA % o.places.length;
      o.places[idx]!.id = "Bad Id";
      return done(`places.${idx}.id`);
    }
    case "duplicate-place-id":
      o.places[1]!.id = o.places[0]!.id;
      return done("places.1.id");
    case "duplicate-suspect-id":
      o.suspects[1]!.id = o.suspects[0]!.id;
      return done("suspects.1.id");
    case "duplicate-statement-id":
      o.suspects[1]!.statements[0]!.id = o.suspects[0]!.statements[0]!.id;
      return done("suspects.1.statements.0.id");
    case "unknown-crime-place":
      o.crime.placeId = "nowhere";
      return done("crime.placeId");
    case "unknown-clue-suspect":
      o.clues[k]!.suspectId = "ghost";
      return done(`clues.${k}.suspectId`);
    case "unknown-statement-ref": {
      const base = `suspects.${si}.statements.${j}`;
      if (st.kind === "possession") {
        st.itemId = "nothing";
        return done(`${base}.itemId`);
      }
      if (st.kind === "sighting" && pickA % 2 === 0) {
        st.seenSuspectId = "ghost";
        return done(`${base}.seenSuspectId`);
      }
      st.placeId = "nowhere";
      return done(`${base}.placeId`);
    }
    case "start-after-end":
      o.crime.startMin = o.crime.endMin + 1;
      return done("crime.endMin");
    case "self-sighting": {
      suspect.statements[0] = {
        id: suspect.statements[0]!.id,
        kind: "sighting",
        text: "I saw myself.",
        seenSuspectId: suspect.id,
        placeId: o.places[0]!.id,
        startMin: 10,
        endMin: 20,
      };
      return done(`suspects.${si}.statements.0.seenSuspectId`);
    }
    case "unknown-key":
      (suspect as Record<string, unknown>)["extra"] = 1;
      return done(`suspects.${si}`);
    case "forbidden-key":
      (st as Record<string, unknown>)["verdict"] = "guilty";
      return done(`suspects.${si}.statements.${j}`);
  }
}

export const mutationArb = validModelOutputArb.chain((valid) =>
  fc
    .tuple(fc.constantFrom(...MUTATION_KINDS), fc.nat(1000), fc.nat(1000))
    .map(([kind, a, b]) => mutate(valid, kind, a, b)),
);
