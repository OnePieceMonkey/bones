import { isCoreError } from "@bones/core";
import { describe, expect, it } from "vitest";
import { deriveFacts } from "../../src/derive/factDeriver";
import { extractCaseFields, modelOutputSchema } from "../../src/pipeline/schema";
import { solve } from "../../src/solver/solve";
import type { SolveResult, SolverReason } from "../../src/solver/solve";
import {
  buildSolverMessages,
  renderAccusationText,
  renderBannerList,
  renderReasonTemplate,
} from "../../src/solver/solverMessages";
import { loadTestBundle, readRecorded } from "../helpers/fixtures";

const LONG = (c: string) => c.repeat(40);
const names = new Map([
  ["a", LONG("A")],
  ["b", "Bram"],
  ["c", "Cleo"],
]);
const noLeft = (text: string) => {
  expect(text).not.toContain("{{");
  expect(text).not.toContain("}}");
  expect(text).not.toContain("undefined");
  expect(text).not.toMatch(/\s{2,}/);
  expect(text.trim()).toBe(text);
  expect(text.length).toBeGreaterThan(0);
};

describe("solver message templates", () => {
  it("renders reason `one`", () => {
    const t = renderReasonTemplate({ code: "one", suspectId: "b" }, names, "v2");
    expect(t).toBe("Rule set v2 convicts exactly one suspect: Bram.");
  });

  it("renders reason `none` with and without missing items", () => {
    const withMissing = renderReasonTemplate(
      { code: "none", closestSuspectId: "b", missing: ["proof-means:b", "no-contradicted-statement"] },
      names,
      "v1",
    );
    expect(withMissing).toContain("Bram still lacks means and a contradicted statement.");
    noLeft(withMissing);
    const none = renderReasonTemplate({ code: "none", closestSuspectId: "b", missing: [] }, names, "v1");
    noLeft(none);
  });

  it("renders reason `many` for 2 and 3 ids", () => {
    expect(renderReasonTemplate({ code: "many", suspectIds: ["b", "c"] }, names, "v1")).toBe(
      "Rule set v1 convicts 2 suspects: Bram and Cleo. This case is unfair.",
    );
    expect(renderReasonTemplate({ code: "many", suspectIds: ["a", "b", "c"] }, names, "v3")).toContain(
      `${LONG("A")}, Bram and Cleo`,
    );
  });

  it("renders every template with 0, 1 and 3 ids, no empty slot, maximum-length names whole", () => {
    const reasons: SolverReason[] = [
      { code: "one", suspectId: "a" },
      { code: "none", closestSuspectId: "a", missing: [] },
      { code: "none", closestSuspectId: "a", missing: ["proof-motive:a"] },
      { code: "many", suspectIds: [] },
      { code: "many", suspectIds: ["a"] },
      { code: "many", suspectIds: ["a", "b", "c"] },
    ];
    for (const r of reasons) {
      const t = renderReasonTemplate(r, names, "v3");
      noLeft(t);
      if (r.code === "one") expect(t).toContain(LONG("A"));
    }
    for (const ids of [[], ["a"], ["a", "b", "c"]]) {
      noLeft(renderBannerList(ids, names));
    }
    expect(renderBannerList([], names)).toBe("Convictable: nobody.");
    expect(renderBannerList(["a", "b", "c"], names)).toBe(`Convictable: ${LONG("A")}, Bram and Cleo.`);
  });

  it("renders the accusation texts", () => {
    expect(renderAccusationText({ suspectId: "b", verdict: "correct" }, names)).toBe("Case closed: Bram is guilty.");
    expect(renderAccusationText({ suspectId: "b", verdict: "incorrect" }, names)).toBe(
      "Wrong suspect: Bram cannot be convicted.",
    );
    noLeft(renderAccusationText({ suspectId: "a", verdict: "correct" }, names));
  });

  it("falls back to the id for an unknown name and ignores prototype keys", () => {
    expect(renderAccusationText({ suspectId: "constructor", verdict: "correct" }, names)).toBe(
      "Case closed: constructor is guilty.",
    );
  });

  it("builds ChatMessage[] from real Solver results", () => {
    const bundle = loadTestBundle();
    if (isCoreError(bundle)) throw new Error(JSON.stringify(bundle));
    const entry = readRecorded().find((r) => r.json.id === "candlesticks")!;
    const fields = extractCaseFields(modelOutputSchema.parse(entry.json.extraction.proposedFields));
    const nm = new Map(fields.suspects.map((s) => [s.id, s.name]));
    const derived = deriveFacts(fields);

    const many = solve(derived, "v1", bundle);
    if (isCoreError(many)) throw new Error("solve failed");
    const manyMsgs = buildSolverMessages(many, null, nm);
    expect(manyMsgs).toHaveLength(1);
    expect(manyMsgs[0]).toMatchObject({ id: "solver-reason", kind: "summary" });
    noLeft(manyMsgs[0]!.text);
    expect(manyMsgs[0]!.text).toMatch(/^Rule set v1 convicts /); // the knob label, not the semver

    const ok = solve(derived, "v2", bundle) as SolveResult;
    expect(buildSolverMessages(ok, null, nm)).toEqual([]);
    const withAcc = buildSolverMessages(ok, { suspectId: ok.convictable[0]!, verdict: "correct" }, nm);
    expect(withAcc).toHaveLength(1);
    expect(withAcc[0]).toMatchObject({ id: "accusation", kind: "result" });
    expect(withAcc[0]!.text).toMatch(/^Case closed: .+ is guilty\.$/);
  });

  it("source reads no model text and no network", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../src/solver/solverMessages.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/fetch|Date\.now|Math\.random|\bllm\b.*import|proposedFields|rawModelOutput/);
  });
});
