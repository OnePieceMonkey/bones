import { isCoreError } from "@bones/core";
import { defaultFormat } from "@bones/xray-ui";
import { describe, expect, it } from "vitest";
import { buildCombinedAnatomy, buildSuspectAnatomy, labelName, truncateName } from "../../src/anatomy";
import { deriveFacts } from "../../src/derive/factDeriver";
import type { DerivedCase } from "../../src/derive/factDeriver";
import { makeFormatValue } from "../../src/format/formatValue";
import { caseFieldsSchema, extractCaseFields } from "../../src/pipeline/schema";
import { bindRuleSet } from "../../src/rules/binder";
import { VERSION_LABELS } from "../../src/rules/catalog";
import { loadTestBundle, readRecorded } from "../helpers/fixtures";

const loaded = loadTestBundle();
if (isCoreError(loaded)) throw new Error(JSON.stringify(loaded));
const bundle = loaded;

function derived(id: string): DerivedCase {
  const file = readRecorded().find((f) => f.json.id === id);
  if (!file) throw new Error(`missing ${id}`);
  return deriveFacts(caseFieldsSchema.parse(extractCaseFields(file.json.extraction.proposedFields)));
}

const IDS = ["greenhouse", "candlesticks", "empty-room"];

/** A 4-suspect case with 5 statements each and 40-character names. */
function bigCase(): DerivedCase {
  const base = derived("greenhouse");
  const stmt = base.suspects[0]!.statements[0]!;
  const suspects = ["aa", "bb", "cc", "dd"].map((k, i) => ({
    ...base.suspects[0]!,
    id: `s-${k}`,
    name: `${String.fromCharCode(65 + i)}`.repeat(40),
    statements: [1, 2, 3, 4, 5].map((n) => ({ ...stmt, id: `st-${k}-${n}` })),
  }));
  return { ...base, suspects };
}

describe("Anatomy_Builder", () => {
  it("gives at most 8 bones per suspect and unique rule ids for 4 suspects with 5 statements", () => {
    const d = bigCase();
    const combined = buildCombinedAnatomy(d);
    expect(combined.bones).toHaveLength(4 * 8);
    expect(new Set(combined.bones.map((b) => b.ruleId)).size).toBe(combined.bones.length);
    for (const s of d.suspects) {
      const own = buildSuspectAnatomy(combined, s);
      expect(own.bones).toHaveLength(8);
      expect(new Set(own.bones.map((b) => b.region)).size).toBe(8);
    }
  });

  it("maps regions by D18", () => {
    const d = derived("greenhouse");
    const s = d.suspects[0]!;
    const own = buildSuspectAnatomy(buildCombinedAnatomy(d), s);
    const region = (id: string) => own.bones.find((b) => b.ruleId === id)?.region;
    expect(region(`proof-motive:${s.id}`)).toBe("skull");
    expect(region(`proof-means:${s.id}`)).toBe("arm-right");
    expect(region(`proof-opportunity:${s.id}`)).toBe("leg-right");
    const regions = ["ribs", "spine", "arm-left", "pelvis", "leg-left"];
    s.statements.forEach((st, j) => expect(region(`statement-${st.kind}-contradicted:${st.id}`)).toBe(regions[j]));
  });

  it("keeps labels at most 40 characters and starting with the suspect name for 40-character names", () => {
    const d = bigCase();
    const combined = buildCombinedAnatomy(d);
    for (const b of combined.bones) {
      expect(b.label.length).toBeLessThanOrEqual(40);
      expect(b.label.startsWith(b.label.slice(0, 1).repeat(5))).toBe(true);
    }
    expect(truncateName("Ada", ": Motive")).toBe("Ada");
    expect(truncateName("x".repeat(40), ": Motive") + ": Motive").toHaveLength(40);
  });

  it("starts every label with the full name when it fits", () => {
    for (const id of IDS) {
      const d = derived(id);
      const combined = buildCombinedAnatomy(d);
      for (const s of d.suspects) {
        for (const b of buildSuspectAnatomy(combined, s).bones) {
          expect(b.label.startsWith(labelName(s.name))).toBe(true);
          expect(b.label.length).toBeLessThanOrEqual(40);
        }
      }
    }
  });

  it("uses instance ids that the Binder produces for some version", () => {
    for (const id of IDS) {
      const d = derived(id);
      const produced = new Set<string>();
      for (const v of VERSION_LABELS) {
        const b = bindRuleSet(bundle.templateRuleSets[v], bundle.templateCatalog, d);
        if (isCoreError(b)) throw new Error(JSON.stringify(b));
        for (const k of b.bindings.keys()) produced.add(k);
      }
      for (const bone of buildCombinedAnatomy(d).bones) expect(produced.has(bone.ruleId)).toBe(true);
    }
  });

  it("labels every derived evidence path and the case fields", () => {
    for (const id of IDS) {
      const d = derived(id);
      const labels = buildCombinedAnatomy(d).fieldLabels;
      for (const k of ["title", "setting", "victim", "crime"]) expect(labels[k]).toBeTruthy();
      d.suspects.forEach((s, i) => {
        for (const p of ["meansAny", "meansFirm", "opportunityAny", "opportunityFirm", "motiveAny", "motiveFirm"]) {
          expect(labels[`suspects.${i}.${p}`]).toBeTruthy();
        }
        s.statements.forEach((_st, j) => {
          for (const p of ["conflictsAny", "conflictsFirm", "authorName"]) {
            expect(labels[`suspects.${i}.statements.${j}.${p}`]).toBeTruthy();
          }
        });
      });
    }
  });
});

describe("formatValue", () => {
  it('formats "crime" for the three recorded cases', () => {
    for (const id of IDS) {
      const d = derived(id);
      const f = buildCombinedAnatomy(d).formatValue!;
      const place = d.places.find((p) => p.id === d.crime.placeId)!.name;
      const item = d.items.find((i) => i.id === d.crime.weaponItemId)!.name;
      const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const out = f("crime", d.crime);
      expect(out).toBe(`${place}, ${hm(d.crime.startMin)}-${hm(d.crime.endMin)}, ${item}`);
      expect(out).toMatch(/^.+, \d\d:\d\d-\d\d:\d\d, .+$/);
    }
  });

  it('formats "amountCents" as a count without a currency symbol', () => {
    const f = makeFormatValue({ places: [], items: [] });
    expect(f("amountCents", 0)).toBe("0 convictable");
    expect(f("amountCents", 1)).toBe("1 convictable");
    expect(f("amountCents", 2)).toBe("2 convictable");
    for (const n of [0, 1, 2]) expect(f("amountCents", n)).not.toMatch(/[$€£¥]/);
  });

  it("falls back to the generic formatter and never throws", () => {
    const f = makeFormatValue({ places: [], items: [] });
    expect(f("title", "Hello")).toBe(defaultFormat("title", "Hello"));
    expect(f("crime", null)).toBe(defaultFormat("crime", null));
    expect(f("crime", { placeId: 1 })).toBe(defaultFormat("crime", { placeId: 1 }));
    expect(f("amountCents", -1)).toBe(defaultFormat("amountCents", -1));
  });
});
