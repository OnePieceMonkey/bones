# Bones Case Files

Case Files is a ghost detective game built on the Bones skeleton. A case has two to four suspects. Each suspect is drawn as a skeleton, each statement is a bone, and a lie is a fracture. The app proves that exactly one suspect can be convicted. A case where nobody or several suspects can be convicted is rejected as unfair.

The three recorded cases are hand-written fixtures in the model output format, not real LLM output.

Live mode is not built in this version. The demo works fully offline with the three recorded fixture cases and needs no API key. When live mode is added, the key lives only on the server and never in the client.

## Why the LLM never decides

An LLM may only read or write messy input and propose structured fields. In this app that proposal is a case in a strict schema (`src/pipeline/schema.ts`). Anything that does not match the schema is rejected and produces no Trace.

After validation, no model is involved:

1. `src/derive/factDeriver.ts` counts facts from the case (for example how many clues overlap a suspect's statement in time). It has no clock, no randomness and no I/O.
2. `src/rules/binder.ts` binds the rule templates in `rules/case-files/` to the suspects and statements of this case.
3. `src/solver/solve.ts` runs the core rules evaluator once and reads only the rule outcomes. A suspect can be convicted when every bound proof rule fires and at least one statement rule fires (a lie).
4. The verdict follows from the number of suspects who can be convicted: one means the case is accepted, zero or more than one means it is unfair.

Confidence values from the model are stored in the Trace but are never an input to the Solver. Dr. Bones, the chat panel, writes only from closed message templates (`src/solver/solverMessages.ts`) and the Trace.

## The five Bones parts in this app

| Part | Where |
|---|---|
| Extraction | `src/extraction/RecordedCaseAdapter.ts` reads one of the three recorded cases. Output must pass `modelOutputSchema`. |
| Rules | `rules/case-files/` (versioned JSON rule files and rule sets), bound per case by `src/rules/binder.ts`. |
| Trace | `src/pipeline/runCasePipeline.ts` stores proposed fields, confidence, validated fields, every rule outcome and the result. |
| Human override | A reviewer can overrule a result. The override is its own record and never edits the original Trace. |
| X-ray UI | Components from `packages/xray-ui`, arranged in `src/ui/`. |

## How to play

1. On the start screen, pick one of the three film sheets (greenhouse, candlesticks, empty room). The "Write a new case" form is disabled and says that live mode is off.
2. On the case screen, read the case on the document and the suspects as name plates with skeletons. Switch X-RAY on to see the bones and fractures.
3. Turn the RULE VERSION knob to v1, v2 or v3. The decision is replayed with that rule set (see below).
4. Select a suspect and press Accuse. Accuse is disabled while nobody is selected, and also when the selected rule set found the case unfair.
5. The verdict view shows whether the accused suspect can be convicted. "New case" returns to the start screen.
6. "Replay" repeats the animation. "Human override" opens a dialog (reviewer name, reason, new result). "Download trace" saves the Trace as a file. "Load another case" returns to the start screen.

## How to run

Install once from the repo root:

- `pnpm install` installs the workspace dependencies.

Then start the dev server:

- `pnpm dev:case-files` starts the app on http://127.0.0.1:5201 (the port is fixed; the server stops if the port is taken).

Scripts of `apps/case-files` (run from the repo root through the pnpm filter for `@bones/case-files`):

| Command | What it does |
|---|---|
| `pnpm --filter @bones/case-files dev` | Dev server on port 5201 (same as `pnpm dev:case-files`). |
| `pnpm --filter @bones/case-files build` | Production build into `apps/case-files/dist`. |
| `pnpm --filter @bones/case-files build:check` | Type check, then production build. |
| `pnpm --filter @bones/case-files preview` | Serves the built app on port 5202. Run `build` first. |
| `pnpm --filter @bones/case-files test` | Unit, property and component tests (Vitest, one run). |
| `pnpm --filter @bones/case-files typecheck` | TypeScript check without output. |
| `pnpm --filter @bones/case-files test:e2e` | Builds, then runs the Playwright e2e tests. |

Scripts of the repo root:

| Command | What it does |
|---|---|
| `pnpm dev:case-files` | Starts this app's dev server. |
| `pnpm e2e:case-files` | Runs this app's e2e tests (same as `test:e2e` above). |
| `pnpm test` | Runs `pnpm -r test` over all packages. |
| `pnpm typecheck` | Runs `pnpm -r typecheck` over all packages. |
| `pnpm e2e` | Runs the e2e tests of the expense auditor, the other app. |

## Rule versions and the verdict matrix

The knob selects a rule set. Replaying changes only the rule set. The case and the derived counts stay the same.

| Rule set | Means | Opportunity | Motive | Location lie | Possession lie | Sighting lie | Reliability used |
|---|---|---|---|---|---|---|---|
| v1 (`case-files@1.0.0`) | any | any | not bound | any | not bound | not bound | `...Any` counts |
| v2 (`case-files@2.0.0`) | any | any | any | any | any | not bound | `...Any` counts |
| v3 (`case-files@3.0.0`) | firm | firm | firm | firm | firm | firm | `...Firm` counts |

Verdict of each recorded case under each rule set (suspects who can be convicted in brackets):

| Case | v1 | v2 | v3 |
|---|---|---|---|
| greenhouse | accepted, [widow] | accepted, [widow] | accepted, [widow] |
| candlesticks | unfair_many, [ada, bram] | accepted, [ada] | accepted, [ada] |
| empty-room | unfair_none, [] | accepted, [dana] | unfair_none, [] |

`accepted` means exactly one suspect can be convicted. `unfair_many` and `unfair_none` mean the case is rejected. The same table is in `rules/case-files/README.md` and is asserted by `tests/unit/expected-matrix.node.test.ts` against `tests/fixtures/expected-matrix.ts`.

## Tests

- `pnpm --filter @bones/case-files test` runs everything under `tests/`: unit tests, component tests (jsdom), property tests with fast-check (`tests/properties/`), recorded-case parity (`tests/parity/`) and the guards below.
- `pnpm -r test` runs the tests of all packages. `pnpm -r typecheck` type checks all packages.
- `pnpm e2e:case-files` runs the Playwright specs in `e2e/` against a fresh production build served on port 5202. They cover the fair case, the unfair cases, wrong accusation, override, keyboard order, the network (no request leaves the app origin), the no-scroll check at three viewport sizes, a flat-view contrast check and reference screenshots. There are two Playwright projects: `chromium` (1440x900) and `chromium-1600` (1600x900). Only Chromium is used. One-time setup: `pnpm --filter @bones/case-files exec playwright install chromium`.

### Reference screenshots

The reference images are in `e2e/__screenshots__/`. A missing reference fails the run, and the config never updates references by itself. Differences up to 0.1% of pixels are tolerated.

The references are platform-specific. They were made on macOS, and system font widths differ on other systems, so run the e2e tests only on the platform that made the references.

To regenerate them on purpose, stop any server on port 5202 (so the build is fresh), then run:

- `pnpm --filter @bones/case-files exec playwright test --update-snapshots` writes new reference images for both projects. Review the changed images before you commit them.

### Guards

Guards are tests in `tests/guards/` that fail when a design rule is broken:

| Guard | What it checks |
|---|---|
| `rules-purity` | Every rule file uses only the allowed shape: a deducting effect, one comparison, paths under `subject`, known rule ids. |
| `solver-purity` | The deriver, binder, Solver and message files use no clock, randomness, network or `eval`, and import only `@bones/core` and local files. |
| `no-llm-in-chat` (node and runtime) | Dr. Bones' text files contain no network or LLM client code, and chat text in the running UI comes from templates. |
| `no-secrets` | A build with canary key values must contain no key, key name or provider host in the browser bundle. |
| `no-expense-auditor`, `workspace-imports` | The app never imports from the expense app or from stray workspace paths. |
| `no-visual-in-app` | `app.css` is layout only. No keyframes, no `url(`, no image imports in the app. |
| `no-raster` | No raster files in the app or the rule files, except the e2e reference screenshots. |
| `contrast` | The text and background pairs the app places meet the contrast thresholds. |

## Security notes

- No API key is in the client. The browser build contains none, and `no-secrets` builds with canary values to check this.
- Case text is always rendered as escaped React text, never as HTML.
- `.env.example` lists server-side names only, with no `VITE_` prefix. The live-mode theme list on the start screen is a closed list of four fixed themes, but it is not connected to anything because live mode is not built.

## Known limitations

- Live mode is not built (see the top of this file). The "Write a new case" form is shown disabled.
- Tab order has extra stops that come from the shared `xray-ui` parts: the document region, the AI answer card, the chat log, the bone buttons while X-RAY is on and the doctor's "Replay decision" button. The app does not remove them because removing them would change the expense app. The full order is in requirement 16.5 and is asserted by `e2e/keyboard.spec.ts`.
- During visual review, the skeleton drawing was seen cropped at the hips and knees. It is not fixed.
- The shared Dr. Bones result line shows the core result words APPROVED or REJECTED (open question Q3), while the app's own banner and solver messages use the solvable/unfair and convictable wording.
- The look of the screens is checked by reference screenshots and by a human reading review images, not by an automated judgment of whether it looks right. The references exist only for macOS.

### Open questions Q1 to Q7

These are decisions for the owner of `packages/core`. Each has a workaround in the app. The full text is in `.kiro/specs/case-files/requirements.md` under "Open questions".

- Q1 Evaluate-all effect: core has no effect that fires without touching an amount, so case rules use deducting effects on dimensionless scopes.
- Q2 Result from outside the rules: core `replay` cannot take a result mapper, so the app replays itself.
- Q3 Result vocabulary: `DecisionResult` and `amountCents` are money-flavoured. The app maps accepted to approved, unfair to rejected and stores a count in `amountCents`.
- Q4 No iteration or boolean operators in the rule AST: the Rule_Binder and the Fact_Deriver exist because of this.
- Q5 Evidence keys and confidence: the gauge matches evidence keys to confidence keys, and case rules use derived paths, so the per-fracture minimum never applies.
- Q6 Browser recorded adapter: core's `RecordedAdapter` is Node-only, so the app has a browser twin.
- Q7 Derived values in `validatedFields`: the Trace keeps the case plus the joined counts, because core has no separate place for derived facts.

## Scope cut

- Cut: live mode (task group 9 in `.kiro/specs/case-files/tasks.md`): no server function, no provider call, no key handling.
- Built, and not cut: recorded mode, the three recorded cases, the Solver, pipeline with Trace, replay, override, trace download, the guards, keyboard access and reduced motion.
- Out of scope by requirement (`requirements.md`, "Out of scope"): accounts, multiplayer, scores, hints, persistence beyond the browser session, a router, sound, mobile layouts below 1280x720, and photo or PDF input.
