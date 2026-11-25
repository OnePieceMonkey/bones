import type { CaseFields, Clue, Statement, Suspect } from "../pipeline/schema";

/**
 * Fact_Deriver. Pure: joins statements and clues and writes integer counts.
 * No clock, no randomness, no I/O, no threshold, no confidence. Order is kept.
 */

export type DerivedStatement = Statement & {
  conflictsAny: number;
  conflictsFirm: number;
  authorName: string;
};

export type DerivedSuspect = Omit<Suspect, "statements"> & {
  meansAny: number;
  meansFirm: number;
  opportunityAny: number;
  opportunityFirm: number;
  motiveAny: number;
  motiveFirm: number;
  statements: DerivedStatement[];
};

export type DerivedCase = Omit<CaseFields, "suspects"> & { suspects: DerivedSuspect[] };

interface Interval {
  startMin: number;
  endMin: number;
}

/** Closed intervals overlap when each starts no later than the other ends. */
function overlaps(a: Interval, b: Interval): boolean {
  return a.startMin <= b.endMin && b.startMin <= a.endMin;
}

type PresenceClue = Extract<Clue, { kind: "presence" }>;
type HoldingClue = Extract<Clue, { kind: "holding" }>;
type MotiveClue = Extract<Clue, { kind: "motive" }>;

interface ClueIndex {
  presence: PresenceClue[];
  holding: HoldingClue[];
  motive: MotiveClue[];
}

const countBoth = <T extends { reliability: "firm" | "weak" }>(
  list: readonly T[],
  pred: (c: T) => boolean,
): { any: number; firm: number } => {
  let any = 0;
  let firm = 0;
  for (const c of list) {
    if (!pred(c)) continue;
    any += 1;
    if (c.reliability === "firm") firm += 1;
  }
  return { any, firm };
};

export function deriveFacts(input: CaseFields): DerivedCase {
  const index = new Map<string, ClueIndex>();
  const forSuspect = (id: string): ClueIndex => {
    let entry = index.get(id);
    if (!entry) {
      entry = { presence: [], holding: [], motive: [] };
      index.set(id, entry);
    }
    return entry;
  };
  for (const clue of input.clues) {
    const entry = forSuspect(clue.suspectId);
    if (clue.kind === "presence") entry.presence.push(clue);
    else if (clue.kind === "holding") entry.holding.push(clue);
    else entry.motive.push(clue);
  }

  const crime = input.crime;
  const suspects: DerivedSuspect[] = input.suspects.map((s) => {
    const own = forSuspect(s.id);
    const means = countBoth(own.holding, (c) => c.itemId === crime.weaponItemId);
    const opportunity = countBoth(
      own.presence,
      (c) => c.placeId === crime.placeId && overlaps(c, crime),
    );
    const motive = countBoth(own.motive, () => true);

    const statements: DerivedStatement[] = s.statements.map((st) => {
      let conflicts: { any: number; firm: number };
      if (st.kind === "location") {
        conflicts = countBoth(own.presence, (c) => c.placeId !== st.placeId && overlaps(c, st));
      } else if (st.kind === "possession") {
        conflicts = st.held
          ? { any: 0, firm: 0 }
          : countBoth(own.holding, (c) => c.itemId === st.itemId);
      } else {
        conflicts = countBoth(
          forSuspect(st.seenSuspectId).presence,
          (c) => c.placeId !== st.placeId && overlaps(c, st),
        );
      }
      return { ...st, conflictsAny: conflicts.any, conflictsFirm: conflicts.firm, authorName: s.name };
    });

    return {
      ...s,
      meansAny: means.any,
      meansFirm: means.firm,
      opportunityAny: opportunity.any,
      opportunityFirm: opportunity.firm,
      motiveAny: motive.any,
      motiveFirm: motive.firm,
      statements,
    };
  });

  return { ...input, suspects };
}
