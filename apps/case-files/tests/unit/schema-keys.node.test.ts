import { describe, it, expect } from "vitest";
import { validate } from "@bones/core";
import { z } from "zod";
import { caseFieldsSchema, modelOutputSchema } from "../../src/pipeline/schema";

const FORBIDDEN = /culprit|guilty|verdict|convict|solution|score/i;

/** Collects every object key found anywhere inside a zod schema. */
function collectKeys(schema: unknown, keys: Set<string> = new Set(), seen = new Set<unknown>()): Set<string> {
  if (typeof schema !== "object" || schema === null || seen.has(schema)) return keys;
  seen.add(schema);
  const def = (schema as { _def?: Record<string, unknown> })._def;
  if (!def) return keys;
  const shape = typeof def["shape"] === "function" ? (def["shape"] as () => Record<string, unknown>)() : undefined;
  if (shape) for (const [k, v] of Object.entries(shape)) { keys.add(k); collectKeys(v, keys, seen); }
  for (const v of Object.values(def)) {
    if (Array.isArray(v)) v.forEach((x) => collectKeys(x, keys, seen));
    else if (v instanceof Map) v.forEach((x) => collectKeys(x, keys, seen));
    else if (typeof v === "object" && v !== null && "_def" in v) collectKeys(v, keys, seen);
  }
  return keys;
}

describe("Case_Schema keys", () => {
  it("walker finds nested keys (self-test)", () => {
    const keys = collectKeys(z.object({ a: z.array(z.object({ verdict: z.string() })) }));
    expect([...keys]).toContain("verdict");
  });

  it("has no key that names a culprit, verdict or score", () => {
    for (const schema of [caseFieldsSchema, modelOutputSchema]) {
      const keys = [...collectKeys(schema)];
      expect(keys).toContain("statements");
      expect(keys).toContain("startMin");
      expect(keys.filter((k) => FORBIDDEN.test(k))).toEqual([]);
    }
  });
});

const base = {
  title: "T", setting: "S", victim: { name: "V" },
  crime: { placeId: "a", startMin: 10, endMin: 20, weaponItemId: "w" },
  places: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
  items: [{ id: "w", name: "W" }],
  suspects: [
    { id: "s1", name: "One", statements: [{ id: "t1", kind: "possession", text: "x", itemId: "w", held: false }] },
    { id: "s2", name: "Two", statements: [{ id: "t2", kind: "location", text: "y", placeId: "b", startMin: 0, endMin: 5 }] },
  ],
  clues: [{ id: "c1", kind: "motive", text: "m", reliability: "firm", suspectId: "s1" }],
  confidence: { title: 0.9 },
};
const ok = (v: unknown): boolean => !("kind" in validate(v as Record<string, unknown>, modelOutputSchema));
const withText = (text: string) => ({ ...base, title: text });

describe("Case_Schema boundaries", () => {
  it("accepts the base case", () => expect(ok(base)).toBe(true));
  it("title: 60 ok, 61 rejected, empty rejected", () => {
    expect(ok(withText("x".repeat(60)))).toBe(true);
    expect(ok(withText("x".repeat(61)))).toBe(false);
    expect(ok(withText(""))).toBe(false);
  });
  it("setting: 240 ok, 241 rejected", () => {
    expect(ok({ ...base, setting: "x".repeat(240) })).toBe(true);
    expect(ok({ ...base, setting: "x".repeat(241) })).toBe(false);
  });
  it("victim name: 40 ok, 41 rejected", () => {
    expect(ok({ ...base, victim: { name: "x".repeat(40) } })).toBe(true);
    expect(ok({ ...base, victim: { name: "x".repeat(41) } })).toBe(false);
  });
  it("statement text 160 and clue text 120 are the maxima", () => {
    const stmt = (n: number) => ({ ...base, suspects: [
      { ...base.suspects[0]!, statements: [{ id: "t1", kind: "possession", text: "x".repeat(n), itemId: "w", held: true }] }, base.suspects[1]!] });
    expect(ok(stmt(160))).toBe(true);
    expect(ok(stmt(161))).toBe(false);
    const clue = (n: number) => ({ ...base, clues: [{ ...base.clues[0]!, text: "x".repeat(n) }] });
    expect(ok(clue(120))).toBe(true);
    expect(ok(clue(121))).toBe(false);
  });
  it("counts: 1 suspect, 7 places, 0 clues, 6 statements rejected", () => {
    expect(ok({ ...base, suspects: [base.suspects[0]] })).toBe(false);
    const places = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: "P" }));
    expect(ok({ ...base, places, crime: { ...base.crime, placeId: "p0" } })).toBe(false);
    expect(ok({ ...base, clues: [] })).toBe(false);
    const sts = Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, kind: "possession", text: "x", itemId: "w", held: true }));
    expect(ok({ ...base, suspects: [{ ...base.suspects[0]!, statements: sts }, base.suspects[1]!] })).toBe(false);
  });
  it("minutes: 0 and 1439 ok, 1440 and -1 rejected", () => {
    expect(ok({ ...base, crime: { ...base.crime, startMin: 0, endMin: 1439 } })).toBe(true);
    expect(ok({ ...base, crime: { ...base.crime, startMin: 0, endMin: 1440 } })).toBe(false);
    expect(ok({ ...base, crime: { ...base.crime, startMin: -1 } })).toBe(false);
  });
  it("rejects control characters and whitespace-only text", () => {
    expect(ok(withText("a\u0000b"))).toBe(false);
    expect(ok(withText("a\u001fb"))).toBe(false);
    expect(ok(withText("   "))).toBe(false);
    expect(ok(withText("a\tb\nc"))).toBe(true);
  });
  it("id: 32 characters ok, 33 and uppercase rejected", () => {
    const idCase = (id: string) => ({ ...base, items: [{ id, name: "W" }], crime: { ...base.crime, weaponItemId: id },
      suspects: [{ ...base.suspects[0]!, statements: [{ id: "t1", kind: "possession", text: "x", itemId: id, held: true }] }, base.suspects[1]!] });
    expect(ok(idCase("a".repeat(32)))).toBe(true);
    expect(ok(idCase("a".repeat(33)))).toBe(false);
    expect(ok(idCase("Abc"))).toBe(false);
  });
  it("rejects confidence values outside [0, 1]", () => {
    expect(ok({ ...base, confidence: { title: 1.1 } })).toBe(false);
    expect(ok({ ...base, confidence: { title: -0.1 } })).toBe(false);
  });
});
