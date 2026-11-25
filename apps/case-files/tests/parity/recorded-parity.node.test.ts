import { describe, it, expect } from "vitest";
import { validate } from "@bones/core";
import { modelOutputSchema } from "../../src/pipeline/schema";
import { readRecorded } from "../helpers/fixtures";

const FORBIDDEN_KEY = /culprit|guilty|verdict|convict|solution|score/i;
const FORBIDDEN_WORDS = /llm|gpt|model-generated/i;

function keysAt(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => keysAt(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      keysAt(v, out);
    }
  }
  return out;
}

const files = readRecorded();

describe("recorded cases (hand-written fixtures)", () => {
  it("has exactly the three ids", () => {
    expect(files.map((f) => f.json.id).sort()).toEqual(["candlesticks", "empty-room", "greenhouse"]);
    for (const f of files) expect(f.fileName).toBe(`${f.json.id}.json`);
  });

  for (const f of files) {
    describe(f.json.id, () => {
      const { extraction } = f.json;

      it("rawModelOutput parses to the proposed fields", () => {
        expect(JSON.parse(extraction.rawModelOutput)).toEqual(extraction.proposedFields);
      });

      it("validates with the Case_Schema", () => {
        const result = validate(extraction.proposedFields, modelOutputSchema);
        expect(result).not.toHaveProperty("kind");
        expect(result).toHaveProperty("suspects");
      });

      it("has at most 4 suspects and 5 statements per suspect", () => {
        const suspects = extraction.proposedFields.suspects as { statements: unknown[] }[];
        expect(suspects.length).toBeLessThanOrEqual(4);
        for (const s of suspects) expect(s.statements.length).toBeLessThanOrEqual(5);
      });

      it("has one confidence value below 0.80 and keeps sources empty", () => {
        expect(Object.values(extraction.confidence).some((c) => c < 0.8)).toBe(true);
        expect(extraction.sources).toEqual({});
        expect(extraction.confidence).toEqual(extraction.proposedFields.confidence);
      });

      it("has no culprit-like key at any depth", () => {
        for (const k of keysAt(f.json)) expect(k).not.toMatch(FORBIDDEN_KEY);
      });

      it("is labelled as a fixture and never claims LLM authorship", () => {
        expect(f.text).not.toMatch(FORBIDDEN_WORDS);
        if ("origin" in f.json) expect(f.json.origin).toBe("fixture");
      });
    });
  }

  it("covers every statement kind across the three cases", () => {
    const kinds = new Set<string>();
    for (const f of files) {
      const suspects = f.json.extraction.proposedFields.suspects as { statements: { kind: string }[] }[];
      for (const s of suspects) for (const st of s.statements) kinds.add(st.kind);
    }
    expect([...kinds].sort()).toEqual(["location", "possession", "sighting"]);
  });
});
