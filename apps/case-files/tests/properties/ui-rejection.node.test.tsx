import { isCoreError } from "@bones/core";
import { cleanup, render, screen } from "@testing-library/react";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { App } from "../../src/App";
import { deriveFacts } from "../../src/derive/factDeriver";
import { RECORDED_CASES } from "../../src/extraction/samples";
import type { RecordedCaseId } from "../../src/extraction/samples";
import { sha256Hex } from "../../src/pipeline/hash";
import { makePortFactory } from "../../src/pipeline/ports";
import { replayCase } from "../../src/pipeline/replayCase";
import { VERSION_LABELS, loadBundle } from "../../src/rules/catalog";
import type { RuleBundle, VersionLabel } from "../../src/rules/catalog";
import { solve } from "../../src/solver/solve";
import { createSessionStore } from "../../src/state/sessionStore";
import type { SessionStore } from "../../src/state/sessionStore";
import { displayedTrace } from "../../src/state/selectors";
import { override as coreOverride } from "@bones/core";
import { validModelOutputArb } from "../helpers/arbitraries";
import { counterPorts } from "../helpers/fakes";

const loaded = loadBundle();
if (isCoreError(loaded)) throw new Error(JSON.stringify(loaded));
const bundle: RuleBundle = loaded;

function storeFor(cases: readonly unknown[]): SessionStore {
  return createSessionStore({
    bundle,
    cases,
    portFactory: makePortFactory(counterPorts()),
    sha256: sha256Hex,
    replayFn: replayCase,
    overrideFn: coreOverride,
  });
}

async function expectRejectedUi(store: SessionStore, id: RecordedCaseId, label: VersionLabel) {
  await store.loadRecordedCase(id);
  store.selectVersion(label);
  const state = store.getState();
  if (state.screen !== "case") throw new Error("case did not load");
  const trace = displayedTrace(state);
  expect(trace.result).toBe("rejected");
  render(<App store={store} />);
  // Select a suspect so that "nobody selected" cannot be the reason for the disabled button.
  const first = screen.getAllByRole("radio")[0] as HTMLElement;
  first.click();
  expect(screen.getByRole("button", { name: "Accuse" })).toBeDisabled();
  cleanup();
}

describe("Rejected case disables Accuse at UI level", () => {
  // Feature: case-files, Property 16: Rejected case disables Accuse
  // **Validates: Requirements 19.7**
  it.each([
    ["empty-room", "v1"],
    ["empty-room", "v3"],
    ["candlesticks", "v1"],
  ] as const)("fixed example: %s under %s", async (id, label) => {
    await expectRejectedUi(storeFor(RECORDED_CASES), id, label);
  });

  it("Property 16: for any generated Case the Solver rejects, the Trace is rejected and Accuse is disabled", async () => {
    await fc.assert(
      fc.asyncProperty(
        validModelOutputArb,
        fc.constantFrom(...VERSION_LABELS),
        async (out, label) => {
          const solved = solve(deriveFacts(out), label, bundle);
          if (isCoreError(solved)) throw new Error(JSON.stringify(solved));
          fc.pre(solved.verdict === "unfair_none" || solved.verdict === "unfair_many");
          const entry = {
            id: "greenhouse",
            title: "Generated",
            extraction: {
              proposedFields: JSON.parse(JSON.stringify(out)),
              confidence: out.confidence,
              sources: {},
              rawModelOutput: JSON.stringify(out),
            },
          };
          await expectRejectedUi(storeFor([entry]), "greenhouse", label);
        },
      ),
      { numRuns: 100 },
    );
  }, 120_000);
});
