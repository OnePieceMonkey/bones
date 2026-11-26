import { isCoreError } from "@bones/core";
import { buildChatMessages } from "@bones/xray-ui";
import { describe, expect, it } from "vitest";
import { buildCombinedAnatomy } from "../../src/anatomy";
import type { DerivedCase } from "../../src/derive/factDeriver";
import { RECORDED_CASE_IDS } from "../../src/extraction/samples";
import { VERSION_LABELS, loadBundle } from "../../src/rules/catalog";
import { solve } from "../../src/solver/solve";
import { buildSolverMessages } from "../../src/solver/solverMessages";
import { displayedTrace } from "../../src/state/selectors";
import { createProductionSession } from "../../src/state/sessionStore";

/** Same code path as CaseScreen and VerdictView: buildChatMessages + solver extraMessages. */
async function allTexts(id: (typeof RECORDED_CASE_IDS)[number], accuseIndex: number | null) {
  const out: string[] = [];
  for (const label of VERSION_LABELS) {
    const store = createProductionSession();
    if ("kind" in store) throw new Error("bundle");
    await store.loadRecordedCase(id);
    store.selectVersion(label);
    const first = store.getState();
    if (first.screen !== "case") throw new Error("no case");
    const derived = displayedTrace(first).validatedFields as unknown as DerivedCase;
    if (accuseIndex !== null) {
      const outcome = store.accuse(derived.suspects[accuseIndex]!.id);
      if (!outcome.ok) continue;
    }
    const s = store.getState();
    if (s.screen !== "case") throw new Error("no case");
    const trace = displayedTrace(s);
    const rules = loadBundle();
    if (isCoreError(rules)) throw new Error("rules");
    const solved = solve(derived, label, rules);
    if (isCoreError(solved)) throw new Error("solve");
    const names = new Map(derived.suspects.map((x) => [x.id, x.name] as const));
    const extra = buildSolverMessages(solved, s.accusation, names);
    out.push(...[...buildChatMessages(trace, buildCombinedAnatomy(derived)), ...extra].map((m) => m.text));
  }
  return out;
}

describe("Dr. Bones says the article once", () => {
  for (const id of RECORDED_CASE_IDS) {
    for (const idx of [null, 0, 1, 2]) {
      it(`${id} v1-v3 ${idx === null ? "without" : `accusing suspect ${idx}`}: no "the the"`, async () => {
        const texts = await allTexts(id, idx);
        expect(texts.length).toBeGreaterThan(0);
        for (const t of texts) expect(t).not.toMatch(/\bthe\s+the\b/i);
      });
    }
  }
  it("role names keep a lowercase article after 'in' (greenhouse)", async () => {
    const texts = await allTexts("greenhouse", null);
    const heads = texts.filter((t) => t.startsWith("I see a fracture in "));
    expect(heads.length).toBeGreaterThan(0);
    expect(heads.some((t) => /^I see a fracture in the (widow|gardener|nephew): /.test(t))).toBe(true);
    for (const t of heads) expect(t).not.toMatch(/fracture in the (Widow|Gardener|Nephew)/);
  });
  for (const [id, names] of [
    ["candlesticks", ["Ada", "Bram", "Clara"]],
    ["empty-room", ["Dana", "Felix", "Greta"]],
  ] as const) {
    it(`proper names in ${id} take no article`, async () => {
      const texts = await allTexts(id, null);
      const heads = texts.filter((t) => t.startsWith("I see a fracture in "));
      expect(heads.length).toBeGreaterThan(0);
      for (const t of heads) {
        expect(t).not.toMatch(/fracture in the /);
        expect(names.some((n) => t.startsWith(`I see a fracture in ${n}: `))).toBe(true);
      }
    });
  }
});
