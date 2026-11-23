# Implementation Plan: visual-polish-2

## Overview

This plan moves the Signature screen and the start screen of the expense-auditor to the concept image `design/mockups/bones-7-retro-b.png`, in small steps. It changes look only. `packages/core`, rules, trace, replay, override and export are not touched. All look and motion live in `packages/xray-ui`. The app only arranges components.

**Hard stops:** Tasks 5, 8, 10, 12 and 16 are Review_Checkpoints and end in a hard stop. Each one regenerates the `chromium-1600` reference screenshots, builds a side-by-side image with `design/mockups/bones-7-retro-b.png`, runs `pnpm -r typecheck`, `pnpm -r test` and `pnpm e2e`, and then STOPS. After finishing a checkpoint task, reply with exactly "checkpoint N done" (N = 5, 8, 10, 12 or 16) and do not start any further task until the user says "weiter". The user compares the side-by-side image with the mockup region by region. The user's verdict is recorded under "Review verdicts" in the Notes at the end of this file.

Step mapping (design test-change ledger S0 to S8 against the tasks here). The grouping of the regions follows the review order requested for this plan, so tasks 3 to 9 are not in the numeric order of the ledger:

| Ledger step | Content | Tasks |
|---|---|---|
| S0 | Guards, tokens, `chromium-1600` project, skip the two 1440 reference tests | 1 |
| S1 | Global look, typography, unboxing | 2 |
| S5 (header part) | Header | 3 |
| S3 | Receipt on film | 4 |
| S4 | Control panel | 6 |
| S5 (phone part) | Phone panel | 7 |
| S2 | Stage composition | 9 |
| S6 | Start screen, live form, `app.css` move, new app guard rule | 11 |
| S7 | Sweeps, accessibility, dead-rule cleanup | 13 |
| S8 | Final 1440x900 references, skips removed, final review | 15, 16 |

Working rules for every task:

- **One commit per task.** Each leaf task states its commit message. Commit only when `pnpm -r typecheck`, `pnpm -r test` and `pnpm e2e` are green. The app builds after every commit.
- **Tests that assert the old look change in the same commit as the code that breaks them** (design ledger). Each such change carries a one-line comment that names `visual-polish-2 R<n>` and the superseded `visual-polish R<m>` (R13.8). No other existing test is edited.
- **Tests are required, not optional.** Property tests and unit tests are part of the task that introduces the code they cover. Only the group "Extra polish" (task 14) is optional.
- **No change under `packages/core`.** No task changes a rule, trace, replay, override or export behaviour. Task 16 verifies the core diff.
- **Reference procedure "Regenerate_1600".** Run `pnpm --filter @bones/expense-auditor exec vite build`, then `pnpm --filter @bones/expense-auditor exec playwright test --project=chromium-1600 reference-1600.spec.ts --update-snapshots`. Every task whose change alters pixels on the start screen or the Signature screen runs this at its end and commits the two changed PNGs under `apps/expense-auditor/e2e/__screenshots__/reference-1600.spec.ts/` in the same commit. It never touches the references of other specs. The config keeps `updateSnapshots: "none"` for normal runs (R11.3, R11.8).
- **No new raster file** (D4) unless a checkpoint verdict asks for it. A task that adds one lists its file name and byte size in the commit message (R12.3).
- New xray-ui code uses none of the words receipt, expense, alcohol, meal, trip, suspect (case-insensitive) in `.ts`, `.tsx` or `.css` under `packages/xray-ui/src` (R9.7). Use "paper", "document", "mark", "film", "contextNote".
- New lengths use `calc(N * var(--xr-u, 1px))` or percentages (R10.5). New animations or transitions follow the motion guard (only `transform`, `opacity`, `filter`; reduced-motion entry in the same file).
- Every new property test is one test with at least 100 runs, tagged `// Feature: visual-polish-2, Property N: <title>` and `// **Validates: Requirements X.Y**`.
- **Checkpoint procedure (used by tasks 5, 8, 10, 12, 16).** Replace N with the task number.
  1. Run Regenerate_1600. Expect no diff. If a PNG differs, keep it and say why in the report.
  2. Copy `reference-1600.spec.ts/signature-case-1600.png` to `.kiro/specs/visual-polish-2/review/cpN-signature-1600.png` and `start-screen-1600.png` to `review/cpN-start-1600.png`.
  3. Build `review/cpN-side-by-side.png` with a temporary `sharp` script kept outside the repository (for example `/tmp/side-by-side.mjs`, run with working directory `packages/xray-ui` so `sharp` resolves): the mockup scaled to 1600x900 on the left, the Signature screenshot on the right.
  4. Run `pnpm -r typecheck`, `pnpm -r test` and `pnpm e2e`. All must pass.
  5. Commit the three review PNGs: `docs(visual-polish-2): add checkpoint N review images`. The design tracks `review/` in git.
  6. HARD STOP. Reply with exactly "checkpoint N done". Wait for "weiter".
  After "weiter", the first action is to record the user's verdict (accepted or the list of changes) in the Notes of this file. That `tasks.md` edit goes into the commit of the next task. If the verdict lists changes, the next task starts with those changes, and Regenerate_1600 runs at its end.

Decisions recorded here:

- **Requirement amendments applied.** `requirements.md` already contains A1 to A9 from the design. Where a task depends on one, it is named in the task (A1 card may overlap the skull, A4 dial measure, A5 panel overlap, A6 no new tab stop for marks, A7 1440 tests skipped, A8 trip text hidden in the header, A9 app guard rule).
- **Region order deviates from the ledger order on purpose.** The checkpoint grouping is: global look, header and receipt (checkpoint 5); control panel and phone (checkpoint 8); stage composition (checkpoint 10); start screen and live form (checkpoint 12); final (checkpoint 16).
- **Shell grid change lives in the control-panel group (task 6.3).** The four-column grid and the panel overlap are needed before the knob and the meter grow. The photo size and the card move later in task 9.
- **`layout.spec.ts` runs only in project `chromium`.** It sets its own viewport per test, so adding 1600x900 to its size lists is enough. `measure-1600.spec.ts` and `reference-1600.spec.ts` run only in `chromium-1600` (the design text lists `layout` in both places; one project is enough).
- **Platform note.** References are made on the developer machine. System sans glyph widths differ between macOS and Linux, so e2e runs only on the platform that made the references (R11, design Risks).
- **Fallback assets.** If a checkpoint verdict says the CSS/SVG meter face (task 6.5) or film backdrop (task 4.1) is not close enough, the next task may add at most 2 webp files of at most 120,000 B each (D4). The task lists name and size in its commit message.

## Tasks

- [x] 1. Preparation: guards, tokens, chromium-1600 project (ledger S0)
  - [x] 1.1 Playwright project chromium-1600, reference and scroll specs
    - Files: `apps/expense-auditor/playwright.config.ts`, `e2e/reference-1600.spec.ts` (new), `e2e/measure-1600.spec.ts` (new), `e2e/layout.spec.ts`, `e2e/__screenshots__/reference-1600.spec.ts/` (new PNGs).
    - Config: add project `chromium-1600` with viewport 1600x900, `reducedMotion: "reduce"`, `colorScheme: "dark"`, `testMatch: /(reference-1600|measure-1600)\.spec\.ts/`. Add `testIgnore: /(reference-1600|measure-1600)\.spec\.ts/` to project `chromium`. Keep `updateSnapshots: "none"`, `snapshotPathTemplate`, `maxDiffPixelRatio: 0.001`, `threshold: 0.2`.
    - `reference-1600.spec.ts`: two tests, `start-screen-1600.png` and `signature-case-1600.png` with `toHaveScreenshot`, `animations: "disabled"`, `await document.fonts.ready`, wait for the three film sheets and for `.xr-shell[data-intro="done"]` (same waits as the 1440 specs). The baseline PNGs are taken from the current look with Regenerate_1600.
    - `measure-1600.spec.ts`: first test only: no page scroll (`scrollHeight <= innerHeight`, `scrollWidth <= innerWidth`) on the start screen and the Signature screen at 1600x900, 1440x900 and 1280x720 (the spec sets the viewport itself). Later tasks append their assertions here.
    - `layout.spec.ts`: add `{ width: 1600, height: 900 }` to `SIZES` and `SCROLL_SIZES`; keep every existing size.
    - Verify that a missing 1600 reference fails a normal run (rename one PNG, run, restore).
    - Commit message: `test(expense-auditor): add chromium-1600 project with reference and scroll specs`
    - _Requirements: 10.1, 10.2, 10.3, 10.6, 11.1, 11.2, 11.3_

  - [x] 1.2 Skip the two 1440 reference tests
    - Files: `apps/expense-auditor/e2e/signature-case.spec.ts`, `e2e/start-screen.spec.ts`.
    - Add `test.skip(true, "refs return in the last task (visual-polish-2 R11.9)")` to the reference-screenshot test of each file only. The burst-corner test in `signature-case.spec.ts` and every other spec stay active. The 1440 PNGs are not touched.
    - Commit message: `test(expense-auditor): skip 1440 reference tests until the final task`
    - _Requirements: 11.5, 11.9_

  - [x] 1.3 New tokens and contrast pairs (no look change)
    - Files: `packages/xray-ui/src/styles/tokens.css`, `packages/xray-ui/src/__tests__/contrast.test.ts`, `packages/xray-ui/src/__tests__/styles/tokens.test.ts` (new).
    - Add only tokens that no existing rule reads, so pixels do not change: `--xr-font-serif`, `--xr-font-sans`, `--xr-font-mono` (values from the design token table, D1), `--xr-text-on-steel-active`, `--xr-steel-sheen`, `--xr-engrave`, `--xr-engrave-active`, `--xr-bg-film`, `--xr-bg-film-deep`, `--xr-line-phone`, `--xr-bg-pillbtn`, `--xr-text-pillbtn`, `--xr-line-pillbtn`, `--xr-bg-header-glass`, `--xr-line-header`, `--xr-bg-pill`, `--xr-text-pill`, `--xr-line-pill`, `--xr-stamp-alpha` (plain number 0.82), `--xr-meter-face-a`, `--xr-meter-face-b`, `--xr-text-on-meter`, `--xr-meter-zone`, `--xr-meter-bezel`. Tokens that change an existing value (`--xr-text-on-steel`, `--xr-bg-paper-doc`, `--xr-bg-bubble`, `--xr-text-bubble`, `--xr-bg-phone-head`) change in the task that uses them (2.1, 4.1, 7.2).
    - `tokens.test.ts`: every token above exists in `tokens.css`; the colour tokens used in a contrast pair are six-digit hex (`--xr-bg-pill`, `--xr-bg-header-glass` are rgba and are checked by their alpha, at most 0.35 for the pill).
    - `contrast.test.ts`: add `NEW_PAIRS_V2` for the pairs that already exist as tokens: pill text on the pill fill blended over the lightest `film.webp` pixel, stamp text on stamp fill blended over the lightest film pixel with `--xr-stamp-alpha`, pillbtn pair, header text on the glass fill over `--xr-bg-deep`, meter text on `#e9dcb6`, meter zone on the face (3:1 for the graphic). Raise the `at least 29 text pairs` count to the new total, with a comment that states why. Add `FOCUS_PAIRS_V2` for the two focus pairs of the design (`--xr-focus-contrast` on the lightest steel pixel after sheen, `--xr-focus` on the darkest steel pixel). Reuse the `blend` helper and the `sharp` scan of task 3.1 of visual-polish; add a `scanSteel()` helper for the average, lightest and darkest pixel of `brushed-steel.webp`.
    - **Property 7: Every text and focus pair meets its ratio**
      - *For any* pair in the list, `contrastRatio(fg, bg)` is at least 4.5; for focus pairs at least 3. The list grows in tasks 2.1, 4.1, 6.3, 7.2 and 3.2.
      - **Validates: Requirements 1.5, 4.1, 5.10, 6.3, 7.5, 9.3**
    - Commit message: `feat(xray-ui): add visual-polish-2 tokens and start the contrast pair table`
    - _Requirements: 1.5, 2.1, 7.4, 7.5, 9.3_

  - [x] 1.4 CSS source helpers and the 120 u size guard
    - Files: `packages/xray-ui/src/__tests__/styles/helpers.ts` (new), `packages/xray-ui/src/__tests__/styles/size-limit.test.ts` (new).
    - `helpers.ts`: `readStyles()` (all `styles/*.css`), `block(selector)`, `mergedDeclarations(selector)` (merges every block whose selector list contains the selector, in file order), `declarations()` (every property and value with file and selector). Use the same `block()` style as `GlassCard.layout.test.tsx`. Later property tests (8, 9, 10) use these helpers.
    - `size-limit.test.ts`: scan `styles/*.css` for `calc\((\d+(?:\.\d+)?) \*` and fail above 120 outside the selectors `.xr-pknob`, `.xr-pmeter`, `.xr-cpanel`. Pre-existing larger values (`.xr-sheet`, `.xr-burst`, `.xr-sheet-thumb` and any other found on the first run) go on a short allow-list with a comment that says they predate this feature. The message names file, selector and number.
    - Add unit tests of the scanner with a bad and a clean sample.
    - Commit message: `test(xray-ui): add css source helpers and 120 u size guard`
    - _Requirements: 10.5, 9.7_

- [x] 2. Global look and typography (ledger S1)
  - [x] 2.1 Unbox labels and remove dashed outlines
    - Files: `styles/xray.css`, `styles/panels.css`, `styles/controls.css`, `styles/tokens.css`, `__tests__/contrast.test.ts`, `__tests__/components/GlassCard.layout.test.tsx`, `e2e/measure-1600.spec.ts`.
    - `xray.css`: delete `.xr-result[data-result="partially_approved"] { border-style: dashed }` (line 472) and replace the `border-style: dashed` of `.xr-result[data-effective="partially_approved"]` (line 490) with `solid`. Replace the dashed `.xr-mark--bbox` and `.xr-mark--line` borders with `solid`. The old `ResultPlate` (used by case-files) shows a solid outline from now on; say so in the commit body.
    - `panels.css`: remove `border: 2px dashed` from `.xr-glass-stamp` (the frame is `stamp-frame.webp`, D5). Add `.xr-doctor .xr-result.xr-result-footer { border: 0; background: transparent; box-shadow: none; outline: 0; }`.
    - `controls.css`: `.xr-cpanel-plaque` and `.xr-pknob-label` lose `background`, `border`, `border-radius`, `padding`. Both get `color: var(--xr-text-on-steel)` and `text-shadow: var(--xr-engrave)`. The active knob label uses `--xr-text-on-steel-active` and `--xr-engrave-active`, weight 500, and loses the `outline: 1px solid` rule.
    - `tokens.css`: change `--xr-text-on-steel` from `#14202a` to `#0b1218` (4.70:1 on the steel average, was 4.12:1).
    - Tests in the same commit: `contrast.test.ts` measures the steel plaque pair on the bare steel average and requires 4.5:1 (comment: visual-polish-2 R5.10 supersedes visual-polish R9). `GlassCard.layout.test.tsx`: if it asserts the dashed stamp fallback, change it to the `stamp-frame.webp` frame (comment names visual-polish R7 superseded by R1.3).
    - `measure-1600.spec.ts` (new tests): computed `border-*-width` 0, `backgroundColor` `rgba(0, 0, 0, 0)`, `backgroundImage` `none`, `boxShadow` `none` for `.xr-cpanel-plaque` and `.xr-doctor-title` (R1.1; `.xr-mark-tag` follows in task 4.2); a loop over `document.querySelectorAll("*")` asserting no `border-*-style` or `outline-style` of `dashed` or `dotted` on the Signature screen (R1.2); the result block computed outline and border style for the approved, partially approved and rejected samples (R1.4).
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): unbox panel labels and drop dashed outlines (R1)`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.9, 5.10, 13.8_

  - [x] 2.2 One type system
    - Files: `styles/header.css`, `styles/sheet.css`, `styles/shell.css` (or `frame.css`, where `.xr-root` and `.xr-shell` are defined), `styles/controls.css`, `styles/panels.css`, `styles/xray.css`, `__tests__/styles/typography.test.ts` (new).
    - `.xr-wordmark` and `.xr-start-title` use `var(--xr-font-serif)` (weight stays 700). `.xr-root` and `.xr-shell` get `font-family: var(--xr-font-sans)`. Remove the two `ui-monospace` declarations in `controls.css`. `.xr-doc .xr-film-text` uses `var(--xr-font-mono)` with `letter-spacing: 0.02em`. `.xr-sheet-line` keeps mono (start-screen thumbnail, outside R2.3).
    - Lower to weight 500: `.xr-answer-head`, `.xr-field-value`, `.xr-rb-head`, `.xr-result-line`, `.xr-stamp-title`, `.xr-sheet-title`, `.xr-doctor-title`, `.xr-form-strip button`. The app rule `.app-button` changes in task 11.3. Header action text and tagline use `--xr-font-sans`.
    - **Property 9: No dashed or dotted style and one font per role**
      - *For any* declaration in `styles/*.css`: `border-style`, `border`, `outline` and side variants contain no `dashed` or `dotted`; every `font-family` value is one of the three font tokens; `--xr-font-serif` appears only in `.xr-wordmark` and `.xr-start-title`; `--xr-font-mono` appears only in selectors that start with `.xr-doc` or `.xr-sheet-line`.
      - **Validates: Requirements 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4**
    - Unit test of the scanner on bad samples (a dashed border, a stray `ui-monospace`).
    - `fonts.test.ts` and the font file count stay unchanged (R2.5).
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): apply serif, sans and mono tokens and lower weights to 500 (R2)`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Header (ledger S5, header part)
  - [x] 3.1 Header icons, action icon prop and contextNote
    - Files: `components/HeaderIcons.tsx` (new), `components/shell/HeaderAction.tsx`, `components/shell/HeaderBar.tsx`, `components/shell/Shell.tsx`, `components/shell/ShellFrame.tsx`, `src/index.ts`, `apps/expense-auditor/src/ui/Toolbar.tsx`, `apps/expense-auditor/src/ui/DecisionView.tsx`, `__tests__/components/HeaderBar.test.tsx`, and the app tests that read the trip text.
    - `HeaderIcons.tsx`: `IconDownload` and `IconLoad`, inline SVG, `aria-hidden="true"`, `focusable="false"`, no `url(`, domain-free names. Export from `index.ts`.
    - `HeaderAction`: optional `icon?: ReactNode`, rendered as `<span className="xr-header-action-icon" aria-hidden="true">{icon}</span>` before the children. Handlers unchanged.
    - `HeaderBar`: optional `contextNote?: ReactNode`, rendered as `<span className="xr-visually-hidden">{contextNote}</span>` inside `.xr-header-brand`. `Shell` and `ShellFrame` forward the prop. The `h1` stays hidden and unique.
    - App: `Toolbar.tsx` passes `IconDownload` and `IconLoad` to its two actions. `DecisionView.tsx` passes the trip text through `contextNote` and removes it from `statusNote` (D8, A8). Button texts "Download trace" and "Load another receipt" and their handlers do not change.
    - Tests: `HeaderBar.test.tsx` adds contextNote in the DOM and hidden class, icon span `aria-hidden`, handlers on click, Enter and Space unchanged. App tests that assert the trip text now find it in the header's hidden span (edit only the query, same text, comment names R7.8). `no-visual-in-app` stays green.
    - Regenerate_1600 (the trip text is no longer visible).
    - Commit message: `feat(xray-ui): add header action icons and hidden contextNote for the trip text`
    - _Requirements: 7.6, 7.7, 7.8, 7.9, 9.4, 13.8_

  - [x] 3.2 Framed header, glass pill, ghost actions
    - Files: `styles/header.css`, `__tests__/contrast.test.ts`, `__tests__/styles/header.test.ts` (new), `e2e/measure-1600.spec.ts`.
    - `.xr-header`: `height: calc(40 * var(--xr-u))`, margin `6 u 14 u`, 1 px `--xr-line-header` border, radius `14 u`, fill `--xr-bg-header-glass`, padding `0 18 u`. Shell row stays 52 u. Tagline starts 16 u right of the wordmark.
    - `.xr-header-pill`: `background: var(--xr-bg-pill)`, `border: 1px solid var(--xr-line-pill)`, `color: var(--xr-text-pill)`, small decorative `::before` dot. `[data-on="true"]` no longer uses `--xr-bg-cyan-fill` (D7). Pill stays centred (`1fr auto 1fr`).
    - `.xr-header-action`: `border-radius: 999px`, background `rgba(232, 244, 248, 0.06)`, 1 px border `rgba(232, 244, 248, 0.35)`, `inline-flex`, gap 6 u, padding `4 u 12 u`, `min-height: 30 u`, gap between actions 14 u. Focus ring: `outline: 3px solid var(--xr-focus)` plus `box-shadow: 0 0 0 5px var(--xr-focus-contrast)`. `.xr-header-status [role="status"]` muted text without box.
    - Any new transition (pill hover opacity) gets the `data-motion` pair or an exact `prefers-reduced-motion` entry in `header.css` (motion guard).
    - Tests: `header.test.ts` source checks (pill alpha at most 0.35, background not `--xr-bg-cyan-fill`, radius, ghost alpha at most 0.1). Extend Property 7 pairs with the pill pair and the header text pair (already in the table; assert they are used by these selectors).
    - `measure-1600.spec.ts`: header width at least 90 % of the viewport and `border-radius` at least 12 px; pill centre within 2 px of the header centre; pill alpha at most 0.35; actions are pills with `svg[aria-hidden]`, gap at least 8 px; "Trip:" not visible but in the accessibility snapshot; wordmark and tagline gap 8 to 24 px; exactly one `h1`. Block the font request and compare header child rectangles with and without the font (R2.7); assert no request to an external font host (R2.6).
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): framed glass header with muted pill and ghost actions (R7)`
    - _Requirements: 2.6, 2.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8, 7.9, 9.2, 9.5_

- [x] 4. Receipt on film (ledger S3)
  - [x] 4.1 Film backdrop, white paper, tilt, curl, clips
    - Files: `styles/panels.css`, `styles/tokens.css`, `__tests__/contrast.test.ts`, `__tests__/components/DocumentPanel.layout.test.tsx`, `e2e/measure-1600.spec.ts`.
    - `tokens.css`: `--xr-bg-paper-doc` from `#efe6cc` to `#f7f6f1` (16.08:1 with `--xr-text-paper-doc #1a1a1a`).
    - `panels.css` as in the design: `.xr-doc` gets `isolation: isolate` and new padding; `.xr-doc::before` is the film (inset 2 u, radius 8 u, gradient `--xr-bg-film` to `--xr-bg-film-deep`, hairline and inner shadow); `.xr-doc-paper` loses the `paper.webp` url, gets two crease gradients, `--xr-bg-paper-doc`, `transform: rotate(-2deg)` and the curl `box-shadow`; `.xr-doc-paper::after` is the curl corner; `.xr-doc .xr-clip { top: calc(-24 * var(--xr-u)) }`. `.xr-doc-scroll` keeps an opaque paper underlay. `paper.webp` stays exported for the start-screen thumbnails.
    - Tests in the same commit: `contrast.test.ts` paper pair becomes token and token times 0.88 (12.25:1), the `paper.webp` darkest-pixel check applies only to `.xr-sheet-thumb` (comment: visual-polish-2 R4.1 supersedes visual-polish R6). `DocumentPanel.layout.test.tsx` and `FilmClip.test.tsx` stay unchanged; run them as proof (two clips, text unchanged).
    - `measure-1600.spec.ts`: paper `backgroundColor` channels at least 235; transform angle between 1 and 4 degrees in absolute value; film is at least 8 px larger than the paper on each side and its average colour has blue minus red at least 10 (screenshot sample); exactly two `.xr-clip`, each inside the film's horizontal range and touching its top edge; the document panel stays inside the lightbox and overlaps neither stage nor control panel at 1600x900, 1440x900, 1280x720 (R4.11).
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): hang the white tilted paper on blue-grey film with curl and clips (R4)`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.11, 12.2, 13.8_

  - [x] 4.2 Field marks, hover labels and centred scan line
    - Files: `styles/panels.css`, `__tests__/components/DocumentPanel.layout.test.tsx`, `__tests__/styles/marks.test.ts` (new), `e2e/measure-1600.spec.ts`.
    - `.xr-doc .xr-film-line` becomes `display: block; position: relative; min-height: calc(18 * var(--xr-u))`. `.xr-doc .xr-mark--line` (and its highlighted state) becomes a 1.5 px `--xr-cyan` bottom border with the `--xr-cyan-glow` box-shadow, no side or top border, no background; highlighted sets `border-bottom-width: 2px`. `.xr-doc .xr-mark-tag` is absolutely placed at the right above the line, `opacity: 0` at rest, `transition: opacity 150ms ease`, no plate colours, `font-family: var(--xr-font-sans)`, `white-space: nowrap`, `max-width: 100%`, never `display: none` or `visibility: hidden`. It shows on `:hover` of the line and on `[data-highlighted="true"]` (A6: no new tab stop, the label follows the linked hotspot). Reduced motion: exact-selector `transition: none` entry in `panels.css`.
    - `.xr-scan`: `height: 2px; left: 0; right: 0`, background `--xr-red`, two-layer red glow, no animation (R4.10).
    - **Property 8: No label selector draws a box**
      - *For any* selector in `LABEL_SELECTORS` (`.xr-cpanel-plaque`, `.xr-mark-tag`, `.xr-doctor-title`, `.xr-pknob-label`, `.xr-doc .xr-mark-tag`, `.xr-doc .xr-mark--line`) the merged declarations contain no `border` other than `0`, `none` or the mark underline, no `background` other than `none` or `transparent`, no `box-shadow` other than `none` (the mark underline glow is the one documented exception).
      - **Validates: Requirements 1.1, 4.6**
    - **Property 10: Hidden mark label stays accessible**
      - *For any* trace and text source, every mark has exactly one `.xr-mark-tag` with the text `<tag>: <label>` in the DOM; the CSS has no `display: none` and no `visibility: hidden` for it, `opacity: 0` at rest, `opacity: 1` for hover and highlighted, and the reduced-motion `transition: none` entry.
      - **Validates: Requirements 4.7, 4.8**
    - `DocumentPanel.layout.test.tsx`: the "whole and unclipped" test keeps `nowrap` and `max-width: 100%` (comment: opacity is not clipping, visual-polish-2 R4.7 supersedes visual-polish R6).
    - `measure-1600.spec.ts`: `.xr-mark-tag` computed border widths 0, background transparent, `box-shadow` none, opacity 0 at rest and 1 on hover of the mark and when the linked hotspot has focus (R1.1, R4.8); mark underline 1 to 2 px in cyan with a glow; scan line colour `--xr-red`, 1 to 3 px high, vertical centre within 6 px of the centre of the total row, width at least 90 % of the paper (R4.9).
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): cyan underline marks with hover labels and a centred red scan line`
    - _Requirements: 1.1, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 9.5, 13.8_

- [x] 5. Checkpoint - global look, header, receipt
  - Follow the Checkpoint procedure with N = 5. The side-by-side image covers regions 1, 2, 7 (header) and 4 (receipt on film) of the design.
  - Ensure all tests pass, ask the user if questions arise.
  - **HARD STOP:** After finishing this task, STOP and reply with exactly "checkpoint 5 done". Do not start any further task until the user says "weiter". The user compares `review/cp5-side-by-side.png` with the mockup. If the verdict says the film backdrop is too flat, the next task may add `film-sheet.webp` (at most 120,000 B, D4).

- [x] 6. Control panel (ledger S4)
  - [x] 6.1 Knob label model
    - Files: `model/knobLabels.ts` (new), `components/panel/Knob.tsx`, `src/index.ts`, `__tests__/properties/knob-labels.test.ts` (new).
    - `knobLabelPositions(count, activeIndex)` and `knobTicks(count)` as in the design (`KNOB = { center: 50, labelRadius: 46 }`, ticks from radius 40.5 to 44 percent along `knobAngle`). `Knob.tsx` uses them instead of the inline `polar`, adds `data-index` to each label, and renders the tick lines as a decorative inline SVG (`aria-hidden="true"`, no stroke yet, so pixels do not change). Role, aria attributes, keyboard operation and rule-version behaviour do not change.
    - **Property 3: Knob labels lie on one circle, are distinct and ordered**
      - *For any* count 1 to 8 and active index in range: every label has `hypot(x - 50, y - 50) = 46` within 0.1, no two positions are equal, `angleDeg` strictly increases with the index (count above 1) and equals `knobAngle(index, count)`, exactly one label is active.
      - **Validates: Requirements 5.3, 5.4**
    - `controls.test.tsx` (existing Knob tests) and `a11y-roles.test.tsx` stay unchanged and green.
    - Commit message: `feat(xray-ui): add knob label ring model and decorative ticks`
    - _Requirements: 5.3, 5.4, 9.1, 9.4_

  - [x] 6.2 Meter geometry model
    - Files: `model/meterGeometry.ts` (new), `src/index.ts`, `__tests__/model/meterGeometry.test.ts` (new).
    - `METER`, `RED_ZONE` (0.75 to 1), `meterPoint`, `meterTicks(majorCount)`, `redZoneArc()` as in the design. Pure; uses the existing `needleAngle`. No component uses it yet except its test, so wire it in task 6.5 (state this in the commit body).
    - **Property 5: Meter scale geometry**
      - *For any* major tick count 2 to 12, tick values strictly increase from 0 to 1, angles equal `needleAngle(value)`, every tick point lies on the scale radius from the pivot within 0.01, `redZoneArc().startAngle` equals `needleAngle(0.75)` and `endAngle` equals the sweep maximum.
      - **Validates: Requirements 5.5**
    - Unit tests: red zone starts at 0.75, `meterPoint(0, r)` is straight up from the pivot.
    - Commit message: `feat(xray-ui): add meter scale and red zone geometry model`
    - _Requirements: 5.5_

  - [x] 6.3 Shell grid and one steel panel with notch
    - Files: `styles/shell.css`, `styles/controls.css`, `styles/panels.css`, `__tests__/contrast.test.ts`, `__tests__/components/ControlPanel.test.tsx` (proof only), `e2e/layout.spec.ts`, `e2e/measure-1600.spec.ts`.
    - `shell.css`: `grid-template-columns: 28fr 8fr 38fr 26fr`, rows `62fr 38fr`, explicit placement: `.xr-doc { grid-area: 1 / 1 / 2 / 2 }`, `.xr-shell-stagecell { grid-area: 1 / 2 / 3 / 4 }`, `.xr-cpanel { grid-area: 2 / 1 / 3 / 3 }`, `.xr-doctor { grid-area: 1 / 4 / 3 / 5 }`. Remove the old `grid-template-areas` and the `grid-area: doc|stage|doctor|ctrl` lines in `panels.css` and `controls.css`, so `shell.css` owns placement.
    - `controls.css`: new `.xr-cpanel` block from the design: negative margin `0 0 -14 u -14 u`, padding `12 u 12 u 14 u 26 u`, gap 8 u, `border-radius: 0 28 u 0 0`, sheen gradient over `brushed-steel.webp`, bevel and top shadow, `z-index: 2`, and the `::before` notch fillet with `mask` and `-webkit-mask`. Mask unsupported falls back to a square corner. No transition.
    - Contrast: extend Property 7 with the steel pair measured on the sheen-blended average (at least 4.5:1) and the two focus pairs from task 1.3 on the real panel colours.
    - `layout.spec.ts`: overlap exception `(.xr-cpanel, .xr-photo)` (A5) and a skeleton-gap check: `.xr-cpanel` right edge plus 10 px is at most photo left plus 0.2243 times photo width, at all sizes. Both panels stay inside the lightbox and do not overlap `.xr-doc` or `.xr-doctor`.
    - `measure-1600.spec.ts`: panel `border-radius` not 0 on the outer corner; panel right edge about 36 % of the lightbox width (within 2 px).
    - The three controls are still the old ones. If they do not fit the new panel, fix only spacing here, not sizes.
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): four-column shell grid and one steel control panel with notch (R5.1)`
    - _Requirements: 5.1, 5.10, 5.11, 9.3, 10.4, 10.5_

  - [x] 6.4 Toggle with the lamp above the lever
    - Files: `components/panel/Toggle.tsx`, `components/panel/ControlPanel.tsx`, `styles/controls.css`, `__tests__/components/Toggle.test.tsx`, `__tests__/components/ControlPanel.test.tsx`, `e2e/measure-1600.spec.ts`.
    - `Toggle.tsx`: the button content becomes `<Lamp/>` then the lever (column). The lever DOM, `data-on` and `data-lit` stay. `ControlPanel.tsx`: knob item is plaque then Knob; meter item is plaque then Meter; toggle item is Toggle then plaque. Tab order stays Knob, then Toggle. The four screws stay.
    - `controls.css`: `.xr-ptoggle { flex-direction: column; gap: calc(4 * var(--xr-u)) }`, `.xr-ptoggle-lever { width: calc(52 * var(--xr-u)) }`, `.xr-shell .xr-plamp { width: calc(26 * var(--xr-u)) }`. The lit `drop-shadow(0 0 calc(10 * var(--xr-u, 1px)) var(--xr-amber-glow))` and `brightness(0.8)` strings stay (asserted by `Toggle.test.tsx`).
    - Tests: `Toggle.test.tsx` adds DOM order (lamp before lever), `aria-checked` and `role="switch"` unchanged. `ControlPanel.test.tsx`: plaque text list and tab order unchanged.
    - `measure-1600.spec.ts`: the lamp is above the lever and amber when on (R5.8).
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): put the amber lamp above the toggle lever (R5.8)`
    - _Requirements: 5.8, 9.1_

  - [x] 6.5 Rectangular VU meter (SVG)
    - Files: `components/panel/Meter.tsx`, `styles/controls.css`, `styles/motion.css`, `assets/index.ts`, `assets/meter.webp` (delete), `__tests__/assets.test.ts`, `__tests__/properties/images.test.tsx` (if it lists `meterUrl`), `__tests__/properties/meter.test.tsx` (new), `e2e/measure-1600.spec.ts`.
    - Rewrite `Meter.tsx` as inline SVG (viewBox `0 0 200 105`) from `meterGeometry`: bezel rect, cream face gradient (`--xr-meter-face-a`/`-b`), scale ticks and numbers in `--xr-text-on-meter`, red zone arc in `--xr-meter-zone` (0.75 to 1.0), needle line from pivot (100, 98). Root stays `.xr-pmeter` with `role="meter"`, `aria-label`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`. The needle group stays `.xr-pmeter-needle` with `data-angle`, `--from/--over/--to` and a `key` on the value, so `Meter.test.tsx` passes unchanged. All decorative SVG parts are `aria-hidden`.
    - `controls.css`: `.xr-pmeter` 150 u x 79 u (the only new size above 120 u besides the knob; on the guard allow-list). `motion.css`: `.xr-pmeter-needle { transform-origin: 100px 104px; transform-box: view-box }`. `xr-needle-swing` and its 700 ms stay (asserted by `css-constants.test.ts`). Reduced motion shows the needle at its final angle by the existing `data-motion` rules.
    - Remove `meterUrl` from `assets/index.ts`, delete `assets/meter.webp` (29,192 B; Asset_Dir total becomes 619,406 B), remove it from the `assets.test.ts` expected list. Run `pnpm -r typecheck` to prove no import is left. The asset-budget test failure message stays.
    - **Property 4: Meter needle follows the confidence model and is monotone**
      - *For any* confidences `a <= b` in 0..1, `needleAngle(a) <= needleAngle(b)`; for any confidence the rendered `data-angle` equals `needleAngle(confidence)`; a missing confidence gives `needleAngle(null)`; `aria-valuenow` equals `round(100 * confidence)`.
      - **Validates: Requirements 5.6, 5.7**
    - `measure-1600.spec.ts`: the meter is a rectangle (bezel `border-radius` below 50 %), keeps `role="meter"`; the needle moves with `transform` only.
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): replace the round gauge with a rectangular SVG VU meter, remove meter.webp (29,192 B)`
    - _Requirements: 5.5, 5.6, 5.7, 9.1, 9.4, 12.1, 12.2, 13.8_

  - [x] 6.6 Large knob with engraved v1/v2/v3 ring and engraved panel labels
    - Files: `styles/controls.css`, `components/panel/ControlPanel.tsx` (spacing only if needed), `e2e/measure-1600.spec.ts`.
    - `.xr-pknob { width: calc(188 * var(--xr-u)); aspect-ratio: 1 }`, `.xr-shell .xr-pknob-dial { inset: 11.5% }` (dial 144.8 u, A4). Tick lines get a stroke from `--xr-text-on-steel`. `.xr-pknob-label` and `.xr-cpanel-plaque` use `font: 500 max(11px, calc(13 * var(--xr-u))) / 1 var(--xr-font-sans)`, `letter-spacing: 0.1em` for the plaques. Each item is a flex column, `align-items: center`, gap 6 u. If the review of the ring shows labels too tight, `labelRadius` goes to 47 and `.xr-pknob` to 192 u (design note).
    - The task measures old and new dial size with Playwright before and after (old: `.xr-pknob-dial` `offsetWidth` 99 px at 1600x900, 79.2 u). The commit message states both pixel values (R5.2).
    - `measure-1600.spec.ts`: `.xr-pknob-dial` `offsetWidth / (79 * u)` between 1.8 and 2.2 with `u` read from `--xr-u` at each of the three viewports; each plaque within 8 px horizontally and 40 px vertically of its control; plaque `text-shadow` contains `rgba(255, 255, 255`; labels v1, v2, v3 have border 0 and transparent background; the active label colour differs from the inactive ones; the panel stays fully visible and clear of `.xr-doc`, `.xr-doctor` and the skeleton pixels at all three viewports (R5.11).
    - Rule-version replay by knob stays as before (`signature.spec.ts` unchanged and green).
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): enlarge the knob dial and engrave its labels (dial 99 px -> 181 px at 1600x900) (R5.2, R5.3, R5.9)`
    - _Requirements: 5.2, 5.3, 5.9, 5.11, 5.12, 10.5_

- [x] 7. Phone panel (ledger S5, phone part)
  - [x] 7.1 Doctor title, home indicator and button icons (DOM)
    - Files: `components/HeaderIcons.tsx`, `components/panels/DoctorPanel.tsx`, `components/panels/ResultFooter.tsx`, `__tests__/components/DoctorPanel.test.tsx`, `__tests__/components/ResultFooter.test.tsx`, and app tests that query "Dr. Bones".
    - `HeaderIcons.tsx`: add `IconReplay` and `IconOverride` (`aria-hidden`, `focusable="false"`, 18x18 viewBox 24). `DoctorPanel.tsx`: title text `Dr. Bones · Radiologist` (U+00B7), and `<span className="xr-doctor-home" aria-hidden="true" />` as last child. The notch span keeps `aria-hidden`. `ResultFooter.tsx`: an `svg.xr-btn-icon` before the text of each button. Texts "Replay decision" and "Human override" and the `onClick` calls do not change.
    - Tests in the same commit: `DoctorPanel.test.tsx` heading name becomes "Dr. Bones · Radiologist", home indicator and notch are `aria-hidden` (comment: visual-polish-2 R6.2 supersedes visual-polish R8). `ResultFooter.test.tsx`: an `svg[aria-hidden="true"]` precedes each button text; callbacks once per activation by mouse and keyboard. App tests: change only the queried name if they use "Dr. Bones" as a heading name.
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): Dr. Bones · Radiologist title, home indicator and button icons`
    - _Requirements: 6.1, 6.2, 6.7, 6.8, 9.4, 13.8_

  - [x] 7.2 Teal bubbles, phone frame, thin bar, pill buttons
    - Files: `styles/panels.css`, `styles/tokens.css`, `__tests__/contrast.test.ts`, `__tests__/components/ResultFooter.test.tsx`, `__tests__/properties/progress-bar.test.tsx` (new), `e2e/measure-1600.spec.ts`.
    - `tokens.css`: `--xr-bg-bubble #1b4f4a`, `--xr-text-bubble #f2fbfa` (8.81:1), `--xr-bg-phone-head #10242c` (14.29:1 with `#e8f4f8`).
    - `panels.css`: `.xr-doctor` frame 1 px `--xr-line-phone` with a softer glow; `.xr-doctor-notch` pill (28 % wide, 14 u high, `border-radius: 999px`, margin-top 8 u); `.xr-doctor-home` (centred, 34 % wide, 4 u high); avatar 44 u; `.xr-doctor .xr-bubble { border-radius: calc(16 * var(--xr-u)) }`; `.xr-progress { height: clamp(2px, calc(4 * var(--xr-u)), 6px); border: 0; border-radius: 999px; background: rgba(232, 244, 248, 0.14); box-shadow: none }`; fill with `--xr-bar-fill` and glow variables, red for partially approved and rejected; `.xr-footer-btn` pills with `min-height: max(44px, calc(40 * var(--xr-u)))`, `--xr-bg-pillbtn`, `--xr-text-pillbtn`, `--xr-line-pillbtn`, sans 500, focus ring as in task 3.2. `.xr-doctor-body` keeps `flex: 1 1 0; min-height: 0; overflow-y: auto`.
    - Tests in the same commit: `ResultFooter.test.tsx` `.xr-progress` source test: `border: 0` still matches `/border:/`; update the comment (visual-polish-2 R6.5 supersedes visual-polish R8). Contrast table: bubble pair, phone head pair, pillbtn pair.
    - **Property 6: Progress share and bar**
      - *For any* approved and claimed cents with `claimed > 0`, `progressShare` is in 0..1, the progressbar `aria-valuenow` equals `round(100 * share)`, the fill `scaleX` equals the share, and the result line is `<RESULT LABEL> <amount>` in upper case.
      - **Validates: Requirements 6.5, 6.6**
    - `measure-1600.spec.ts`: notch width 60 to 140 px; avatar at least 40 px; bubbles `border-radius` at least 12 px; progress height 2 to 6 px, no border, no dashed outline; "PARTIALLY APPROVED $41.50" text for the Signature case; buttons at least 44 px high with `border-radius` at least half the height and an `svg[aria-hidden]`; chat body scrolls inside its box and the page has no scrollbar at 1280x720 (R6.9); replay and override actions work as before.
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): phone panel with teal bubbles, thin bar and pill buttons (R6)`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.9, 6.10, 9.3, 13.8_

- [x] 8. Checkpoint - control panel and phone
  - Follow the Checkpoint procedure with N = 8. The side-by-side image covers regions 5 (control panel) and 6 (phone panel) of the design.
  - Ensure all tests pass, ask the user if questions arise.
  - **HARD STOP:** After finishing this task, STOP and reply with exactly "checkpoint 8 done". Do not start any further task until the user says "weiter". If the verdict says the meter face or the notch fillet is not close enough, the next task uses the fallbacks from the design (`meter-face.webp` at most 120,000 B, or an inline SVG notch path).

- [x] 9. Stage composition (ledger S2)
  - [x] 9.1 ECG starts at the left-most fracture
    - Files: `model/ecg.ts`, `types.ts` (`EcgModel.startX`), `components/stage/EcgBand.tsx`, `styles/stage.css`, `styles/xray.css`, `__tests__/properties/ecg-start.test.ts` (new), `e2e/measure-1600.spec.ts`.
    - `ecgStartX(bones)` (minimum clamped x of fractured bones, `ECG_CENTER = 280` when none), `ecgPath(spikeXs, flatline, startX)` with the rules of the design (flat line `M{startX},30 L560,30`; beats only where `x - 14 >= startX`; spike path start `max(startX, x - 8)`). `EcgBand.tsx` sets `--xr-ecg-start` to `(startX / width) * 100%` and `viewBox = startX 0 (width - startX) height`, `preserveAspectRatio="none"`. `stage.css`: `.xr-ecg-band { left: var(--xr-ecg-start, 0%); right: 0; width: auto; height: calc(var(--xr-photo-w) * 60 / 560); aspect-ratio: auto; top: calc((50 - 3) / 62 * 100%) }` (the `top:` text stays literal for `css-constants.test.ts`; until task 9.3 defines `--xr-photo-w`, use the old width expression as the fallback inside `var()`). `xray.css`: `.xr-ecg-line` stroke 1.5 with a cyan `drop-shadow`; `.xr-ecg-spike` keeps `--xr-red` with a red `drop-shadow`.
    - **Property 1: ECG starts at the left-most fractured hotspot**
      - *For any* bone set with any states and x in 0..100 percent, `ecgStartX` equals the minimum clamped x of the fractured bones, or 280 when none; every x in `linePath` and `spikePath` is at least `startX`; with at least one fracture and no flatline the minimum x of `spikePath` equals `startX`.
      - **Validates: Requirements 3.6, 3.7**
    - **Property 2: ECG spikes remain at the fractured positions and are red**
      - *For any* bone set, the apex x values of `spikePath` equal the clamped x of the fractured bones, their count equals `spikeXs.length`, `summary` is `"<n> spike(s)"` or `"flatline"`, and a flatline result has no spike path.
      - **Validates: Requirements 3.6, 3.8**
    - `EcgBand.test.tsx` and `ecg-model.test.ts` stay unchanged and green (spike x alignment, flatline). `fx-stacking.test.tsx` runs as proof.
    - `measure-1600.spec.ts`: the left-most `.xr-hotspot[data-state="fractured"]` centre x is within 8 px of `.xr-ecg-band` left; band right reaches the stage right edge; spike colour red, line cyan. A second test opens the clean recorded sample (no fracture): band left is within 8 px of the photo centre (R3.7).
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): start the ECG line at the left-most fractured hotspot (R3.6, R3.7)`
    - _Requirements: 3.6, 3.7, 3.8_

  - [x] 9.2 Soft glow hotspots
    - Files: `styles/stage.css`, `__tests__/components/hotspot.test.tsx` (proof only), `e2e/measure-1600.spec.ts`.
    - `.xr-hs-ring`: `border: 0`, `border-radius: 50%`, radial-gradient from `--xr-hs-core` and `--xr-hs-mid`, `filter: blur(calc(1.5 * var(--xr-u, 1px)))`, no box-shadow, `pointer-events: none`. States set `--xr-hs-core` and `--xr-hs-mid` (cyan glow for passed and applied-no-change, `--xr-red-glow` with `inset: -30%` for fractured, dim for not-applicable). Merge the second `.xr-hs-ring--fractured` block at the end of `stage.css` into the first. `.xr-hs-check` keeps its role, size `max(10px, 11 u)`, opacity 0.8. `.xr-hotspot .xr-bone-btn:focus-visible` keeps the white outline plus dark outer shadow (R3.10).
    - Hotspots stay at least 24x24 px focusable. Class names `.xr-hs-ring--<state>` do not change, so `hotspot.test.tsx` stays unchanged.
    - `measure-1600.spec.ts`: computed `border-top-width` 0, `border-radius` 50 %, background contains `radial-gradient` on `.xr-hs-ring`; fractured glow uses the red token, passed uses the cyan token; focus ring `outline-width` at least 3 px on a focused hotspot (R3.9, R3.10, R3.11); rule box still joined to the bone by a line on hover and focus (R3.12).
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): replace hotspot rings with soft red and cyan bone glows (R3.9 to R3.11)`
    - _Requirements: 3.9, 3.10, 3.11, 3.12, 13.6_

  - [x] 9.3 Larger skeleton anchored to the stage bottom
    - Files: `styles/shell.css`, `styles/stage.css`, `__tests__/helpers/stageGeometry.ts` (new), `__tests__/properties/stage-layout.test.ts` (new), `__tests__/components/SkeletonPhoto.test.tsx`, `__tests__/css-constants.test.ts`, `e2e/layout.spec.ts`, `e2e/measure-1600.spec.ts`.
    - `shell.css`: `.xr-shell-stagecell { overflow: hidden; container-type: size; --xr-photo-w: min(110cqw, 99.58cqh) }`. `stage.css`: `.xr-stage { place-items: end center }`, `.xr-photo { width: var(--xr-photo-w); aspect-ratio: 1208 / 1116; flex: none }`, preceded by a fallback line `width: 100%` for browsers without `cq` units. `anchors.ts`, `placeBones`, `toCropPercent`, `Stage.tsx` and `SkeletonPhoto.tsx` do not change, so anchors stay percentages of the crop box.
    - `stageGeometry.ts` mirrors the five layout formulas of the design (photo width and height, card top, rib top, card height budget, panel right edge, skeleton worst left edge).
    - **Property 11: Layout model holds the stage criteria over the 16:9 family**
      - *For any* viewport width 1280..2560 and height `width * 9 / 16`: photo height over stage height at least 0.9, card bottom at most rib top and at most 45 % of the photo height, card height budget at least 150 u, panel right edge at least 10 px left of the skeleton's worst left edge.
      - **Validates: Requirements 3.1, 3.2, 3.5, 5.11, 10.4**
    - Existing tests changed in the same commit: `SkeletonPhoto.test.tsx` or `css-constants.test.ts` where they assert `min(100cqw, 100cqh * 1.0824)` (comment: visual-polish-2 R3.5 supersedes visual-polish R5). `fx-stacking.test.tsx`, `anchors.test.ts`, `bone-partition.test.ts`, `rule-box-placement.test.ts` stay unchanged and green.
    - `layout.spec.ts`: skeleton-gap check stays at all sizes. `measure-1600.spec.ts`: at 1600x900 photo height at least 90 % of the stage height (expected 91.5 %), photo centre within 2 % of the stage width of the stage centre, photo bottom equals stage bottom; the model of `stageGeometry.ts` matches the real rectangles within 2 px at 1280x720 and 1600x900. The existing no-black-corner burst test at 1440 must stay green.
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): enlarge the skeleton and anchor it to the stage bottom (R3.5)`
    - _Requirements: 3.5, 10.4, 10.5, 5.11, 13.8_

  - [x] 9.4 Glass card at the top centre with compact rows
    - Files: `styles/shell.css`, `styles/panels.css`, `__tests__/components/GlassCard.layout.test.tsx`, `e2e/layout.spec.ts`, `e2e/measure-1600.spec.ts`.
    - `shell.css`: `.xr-shell-stagecell .xr-glass { position: absolute; left: 24%; width: 52%; top: max(calc(2 * var(--xr-u)), calc(100% - var(--xr-photo-w) / 1.0824 * 1.06)); max-height: calc(160 * var(--xr-u)); z-index: 3 }`. Remove the old `left: 2%; bottom: 3%; width: 44%; max-height: 62%`. The flat view (`data-xray="false"`) sets `top: auto`.
    - `panels.css`: `.xr-glass .xr-field` becomes a two-column grid (30 % and the rest), `font-size: max(11px, calc(12 * var(--xr-u)))`, `line-height: 1.25`; `.xr-glass .xr-field dd` is a wrapping flex row with the confidence inline; `.xr-glass .xr-conf` 10 u; radius `calc(14 * var(--xr-u))`. Remove `.xr-glass .xr-field dt { flex: 0 0 32% }` and the `dd` `flex: 1 1 0` lines. Keep backdrop blur, `glass-cracks.webp` overlay and `overflow-y: auto` on `.xr-glass-body`. Row text, confidence text and badge text do not change.
    - `GlassCard.layout.test.tsx` (comment: visual-polish-2 R3.1 supersedes visual-polish R3.4 and R7): the shell block asserts `position: absolute`, `left:`, `width:`, `max-height:`, no `height:`, and no `bottom:` or `left: 2%`; the `gap:`, no `overflow: hidden` on field, `dt` and `dd`, and `overflow-y: auto` assertions stay true.
    - `layout.spec.ts`: keep the `(.xr-glass, .xr-photo)` overlap exception (A1) and nothing else; the card must not overlap `.xr-doc`, `.xr-doctor`, `.xr-cpanel` or `.xr-header`.
    - `measure-1600.spec.ts`: at 1600x900, 1440x900 and 1280x720: card centre within 5 % of the stage width of the photo centre; card bottom at most photo top plus 0.22 times photo height (rib top) and at most photo top plus 0.45 times photo height; card width 35 to 55 % of the stage width; no overlap as above; every field row at least 4.5:1 outside the stamp box (computed text colour on the sampled background).
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): move the cracked glass card to the top centre above the ribs (R3.1 to R3.3)`
    - _Requirements: 3.1, 3.2, 3.3, 10.4, 13.1, 13.8_

  - [x] 9.5 Overrule stamp across the card diagonal
    - Files: `styles/panels.css`, `__tests__/components/GlassCard.layout.test.tsx`, `__tests__/properties/glass-document.test.tsx`, `e2e/measure-1600.spec.ts`.
    - `.xr-glass-stamp`: `right: 9%; bottom: 14%; width: 62%; box-sizing: border-box; padding: calc(5 * var(--xr-u)) calc(10 * var(--xr-u)); border: 0; background: rgba(58, 15, 20, var(--xr-stamp-alpha)); transform: rotate(-9deg); text-align: center`. `.xr-glass[data-overruled="true"]` keeps `padding-bottom: calc(26 * var(--xr-u))`. The frame stays `stamp-frame.webp`. Text colour stays `--xr-text-stamp-live`.
    - Tests in the same commit: `GlassCard.layout.test.tsx` stamp block still asserts `position: absolute`, `right:`, `bottom:`, no `top:`; add a rotation between -20 and -5. `glass-document.test.tsx` rotation test (5 to 12 degrees) only changes its comment, since `-9deg` satisfies both (visual-polish-2 R3.4 supersedes visual-polish R7). The stamp pair in the contrast table is already present from task 1.3.
    - `measure-1600.spec.ts`: stamp rect inside the card rect; stamp centre inside the central 60 % of the card width and height; computed transform angle between -20 and -5 degrees; the stamp crosses the card's top-left to bottom-right diagonal; stamp text at least 4.5:1 on its own fill.
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): stamp OVERRULED BY RULE diagonally across the glass card (R3.4)`
    - _Requirements: 1.3, 3.4, 13.1, 13.8_

- [x] 10. Checkpoint - stage composition
  - Follow the Checkpoint procedure with N = 10. The side-by-side image covers region 3 (card, skeleton, hotspots, ECG, stamp) of the design.
  - Ensure all tests pass, ask the user if questions arise.
  - **HARD STOP:** After finishing this task, STOP and reply with exactly "checkpoint 10 done". Do not start any further task until the user says "weiter". The user checks the card position, the stamp, the skeleton size and the ECG start against the mockup. If the 91.5 % margin must grow, the design names the cap factor 1.1 as the lever (1.12 gives 93.2 %).

- [x] 11. Start screen, live form and app.css move (ledger S6)
  - [x] 11.1 Custom file button and steel live form
    - Files: `components/FormStrip.tsx` (add `FormStripFile`), `styles/form.css` (new), `styles/sheet.css`, `src/index.ts`, `apps/expense-auditor/src/ui/` (the file in which the live form is rendered), `__tests__/components/FormStrip.test.tsx`, `e2e/measure-1600.spec.ts`.
    - `FormStripFile` with the DOM from the design: `.xr-file` wrapper, label span with an id, native `input[type="file"]` with `aria-labelledby` (visually hidden by the clip pattern, not `display: none`, stays in the tab order), and a `label.xr-file-button` (`aria-hidden`) with an icon and the file name or the placeholder. `.xr-file-input:focus-visible + .xr-file-button` draws the ring (3 px white outline plus dark outer shadow, at least 3:1). Props: `label`, `accept`, `placeholder`, `onFile`. The app swaps its `<input type="file">` for `FormStripFile` with label "Upload receipt photo" and placeholder "Choose a photo". The accessible name stays exactly "Upload receipt photo".
    - `form.css` (imported in `index.ts` next to `sheet.css`): move every `.xr-form-strip*` rule and `.xr-form-strip input|button` rule out of `sheet.css`. The strip is a steel surface with sheen and radius `18 u`, engraved legend and labels (`--xr-text-on-steel`, `--xr-engrave`), inputs and button with `appearance: none`, `font-family: var(--xr-font-sans)`, `min-height: max(44px, calc(36 * var(--xr-u)))`, pill button and file button, input fill `rgba(5, 9, 13, 0.55)` with inner shadow and `--xr-text`. `.xr-form-strip` stays `position: absolute; bottom: 14 u`, one wrapping row at 1280x720 within `max-width: 94 %`. Transitions (if any) get the `data-motion` pair or exact reduced-motion entry in `form.css`. Add the contrast pair for the input text on the darkest steel blend to Property 7.
    - Tests: `FormStrip.test.tsx` adds `FormStripFile`: input in the DOM and not `display: none`, shows the placeholder, shows the file name after a change event, accessible name equals the label. `StartScreen.test.tsx` and `App.test.tsx` stay unchanged (`getByLabelText("Upload receipt photo")` is the proof). `LIVE_EXTRACTION=off` still hides the form (R8.8).
    - `measure-1600.spec.ts`: if the live form can be shown through the existing live-status mechanism (see `extraction/liveStatus.ts`; mock the status with `page.route`), assert `appearance: none`, `font-family` equals the sans token, `min-height` at least 44 px for text input, select, submit button and file button; native input present, hidden, focusable; focus ring at least 3 px; the strip fits without page scroll at the three viewports and does not overlap the film sheets. If it cannot be shown, cover these through the CSS-source test and say so in the report.
    - Regenerate_1600.
    - Commit message: `feat(xray-ui): steel live form with a custom file button (R8.1 to R8.4)`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 8.8, 9.2, 10.6_

  - [x] 11.2 Move app buttons, inputs, dialog, error and status styling into xray-ui
    - Files: `styles/form.css`, `styles/header.css`, `apps/expense-auditor/src/ui/OverrideDialog.tsx`, `ErrorPanel.tsx`, `DecisionView.tsx`, `StartScreen.tsx` (the files that use `.app-*` classes), `apps/expense-auditor/tests/guards/contrast.node.test.ts`.
    - `form.css` adds `.xr-btn`, `.xr-btn--primary`, `.xr-input`, `.xr-field-label`, `.xr-counter`, `.xr-field-error`, `.xr-dialog`, `.xr-error`, `.xr-status` with the visual parts of the old `.app-*` rules (colours, borders, radius, font tokens, focus ring). `header.css`: `.xr-header-status [role="status"]` takes over `.app-note` (muted, no box). Rule names follow the move table of the design.
    - App: class names change in the `.tsx` files (`app-button` to `xr-btn`, `app-button-primary` to `xr-btn xr-btn--primary`, `app-input` to `xr-input`, `app-error` to `xr-error`, `app-dialog` to `xr-dialog`, `app-status` to `xr-status`, `app-note` removed in favour of the header status rule, `app-field label` to `xr-field-label`, counter and field error likewise). Only class names change; no handler, request or flow changes (R8.7). Old `.app-*` rules stay in `app.css` until task 11.3 (dead, harmless).
    - `contrast.node.test.ts`: selector labels `.app-note`, `.app-button`, `.app-input` become `.xr-note`/header status, `.xr-btn`, `.xr-input`; token pairs unchanged (comment: visual-polish-2 D2).
    - Run `App.test.tsx`, `OverrideDialog.test.tsx`, `StartScreen.test.tsx`, `DecisionView.test.tsx`: they must pass with no edits besides class-name queries, if any use them.
    - Regenerate_1600.
    - Commit message: `refactor(expense-auditor): move button, input, dialog, error and status styling to xray-ui form.css (D2)`
    - _Requirements: 8.1, 8.4, 8.7, 9.2, 13.8_

  - [x] 11.3 Strip visual rules from app.css and add the app guard rule
    - Files: `apps/expense-auditor/src/styles/app.css`, `apps/expense-auditor/src/App.tsx` (root class), `packages/xray-ui/src/styles/form.css`, `apps/expense-auditor/tests/guards/no-visual-in-app.node.test.ts`.
    - `app.css` keeps only layout of app-owned wrappers (`main` padding, `.app-sheets`, `.app-field` and `.app-actions` flex, `.app-sheets + .app-status` positions) and the `body` rule (its font becomes `var(--xr-font-sans)`). All colour, border, background, shadow and font declarations go away. The `:focus-visible` outline moves to `form.css` scoped to `.xr-shell, .xr-app`; the app root gets `className="xr-app"` (only the expense app sets it, so case-files is not affected).
    - Guard: add the rule `visual declaration in app.css` (pattern `(?:^|[;{\s])(?:border(?:-[a-z]+)*|box-shadow|text-shadow|font-family|font-weight|color|background(?:-[a-z]+)*)\s*:` on `.css`) with a small parser that strips the `body { ... }` block before matching. Add two sample entries to the existing bad and clean sample tests (a bad `app.css` with `color: red` outside `body`, a clean one with only `display: flex`).
    - The guard passes on the real `app.css`; `workspace-imports` guard unaffected. `StartScreen.test.tsx` and `App.test.tsx` unchanged.
    - Regenerate_1600.
    - Commit message: `refactor(expense-auditor): keep only layout in app.css and guard against visual rules (D2, A9)`
    - _Requirements: 8.1, 8.7, 9.7, 13.8_

- [-] 12. Checkpoint - start screen and live form
  - Follow the Checkpoint procedure with N = 12. The side-by-side image still compares the Signature screen with the mockup; `cp12-start-1600.png` is the start screen for the user's visual review of region 8.
  - Ensure all tests pass, ask the user if questions arise.
  - **HARD STOP:** After finishing this task, STOP and reply with exactly "checkpoint 12 done". Do not start any further task until the user says "weiter".

- [ ] 13. Sweeps, accessibility and cleanup (ledger S7)
  - [~] 13.1 Playwright sweeps at three viewports
    - Files: `apps/expense-auditor/e2e/measure-1600.spec.ts`.
    - Boxed_Element sweep on the Signature screen at 1600x900: every element with a visible border, non-transparent background or image, or box-shadow that is not on the allow-list of the design (`.xr-glass`, `.xr-rulebox`, `.xr-doctor`, `.xr-bubble`, `.xr-footer-btn`, `.xr-header`, `.xr-header-pill`, `.xr-header-action`, `.xr-steel`, `.xr-cpanel`, `.xr-pmeter`, `.xr-doc-paper`, `.xr-doc-film` (the film pseudo-element belongs to `.xr-doc`), `.xr-hotspot .xr-bone-btn`, image elements) fails (R1.6). Findings are fixed in CSS in this task, not hidden by the allow-list.
    - Font sweep: no element outside the wordmark and headline has a computed `font-family` starting with "Cormorant SC"; none outside `.xr-doc` contains `monospace`, `Menlo` or `Consolas`; every other text element has `font-weight` 400 or 500 (R2.2 to R2.4).
    - Focus sweep: tab through Knob, Toggle, a hotspot, footer buttons, header actions; each has `outline-width` at least 3 px (R9.2). Decorative check: notch, home indicator, avatar, icons, ticks, clips, curl carry `aria-hidden="true"` or `alt=""` (R9.4). Roles `slider`, `meter`, `switch` present (R9.1).
    - No-scroll on start and Signature screens at 1600x900, 1440x900, 1280x720 (R10.1 to R10.3, R10.6); all five regions inside the viewport with the allowed overlaps only (R10.4); no network request to a font host (R2.6).
    - Regenerate_1600 (expected no diff unless a finding was fixed).
    - Commit message: `test(expense-auditor): add boxed, font, focus and layout sweeps at three viewports`
    - _Requirements: 1.6, 2.2, 2.3, 2.4, 2.6, 9.1, 9.2, 9.4, 10.1, 10.2, 10.3, 10.4, 10.6, 11.4_

  - [~] 13.2 Dead-rule cleanup and guard proof
    - Files: `packages/xray-ui/src/styles/*.css`, `packages/xray-ui/src/__tests__/assets.test.ts`, `__tests__/styles/` (if a check is added).
    - Grep each removed or replaced rule and delete leftovers: the old `.xr-pknob-label` plate and active outline, the old `.xr-hs-ring` border rules, the old round-gauge CSS for `.xr-pmeter`, `.xr-doc-paper` `paper.webp` url, old `.app-*` references in `packages/xray-ui`. The `xray.css` legacy section stays untouched because case-files and the old `XrayView` still use it.
    - Prove with the existing suites, without edits: `fonts.test.ts`, `domain-isolation.test.ts`, `guards/assets-guard.test.ts`, `source-hygiene.test.ts`, `guards/motion-guard.test.ts`, `a11y-roles.test.tsx`. Add one assertion to `assets.test.ts` that the Asset_Dir total equals the measured value and stays at most 1,500,000 B (expected 619,406 B), and that the failure message contains total and budget (R12.1, R12.6). Verify no `img` without positive integer `width` and `height` (existing Property 20 stays green; R12.5).
    - Regenerate_1600 only if CSS cleanup changes pixels (it should not).
    - Commit message: `chore(xray-ui): remove dead look rules and assert the asset total after the meter swap`
    - _Requirements: 2.5, 9.5, 9.7, 9.8, 12.1, 12.4, 12.5, 12.6_

- [ ]* 14. Extra polish (optional)
  - [ ]* 14.1 README section for the new look
    - Add a short section to `packages/xray-ui/README.md`: the three font tokens, the one-bundled-font rule (D1), the `--xr-u` scaling, the Asset_Dir total after this feature, the `chromium-1600` project and how to regenerate its references. Do not mention domain words.
    - Commit message: `docs(xray-ui): document the type system, scaling and 1600 references`
    - _Requirements: 2.1, 11.1, 12.1_

- [ ] 15. Final: 1440x900 references and last review
  - [~] 15.1 Regenerate the two 1440x900 references and remove the skips
    - Files: `apps/expense-auditor/e2e/signature-case.spec.ts`, `e2e/start-screen.spec.ts`, `e2e/__screenshots__/start-screen.spec.ts/start-screen.png`, `e2e/__screenshots__/signature-case.spec.ts/signature-case.png`.
    - Remove the `test.skip` lines added in task 1.2. Regenerate on purpose with `pnpm --filter @bones/expense-auditor exec vite build` and `pnpm --filter @bones/expense-auditor exec playwright test --project=chromium start-screen.spec.ts signature-case.spec.ts --update-snapshots`. Look at both new images before committing. Only these two PNGs change; the 1600 PNGs and the PNGs of other specs do not.
    - Run `pnpm e2e` without the update flag: all specs pass, none skipped.
    - Commit message: `test(expense-auditor): regenerate 1440x900 references and remove skips (start-screen.png, signature-case.png)`
    - _Requirements: 11.5, 11.9_

- [~] 16. Final checkpoint
  - Follow the Checkpoint procedure with N = 16, with these additions before the commit of the review images:
    - The side-by-side image is also saved as `review/final-side-by-side.png` (R11.10).
    - Run `pnpm -r typecheck`, `pnpm -r test`, `pnpm e2e` (no skips, no update flag) and `git diff --exit-code <commit before this feature> -- packages/core`. No file under `packages/core` may differ.
    - `git diff --stat <commit before this feature>` on test files shows only tests named in the tasks above (contrast, GlassCard.layout, glass-document, DocumentPanel.layout, DoctorPanel, ResultFooter, HeaderBar, Toolbar or App queries, FormStrip, SkeletonPhoto or css-constants, assets, guards, e2e specs).
    - `git status` is clean after the review commit (the review PNGs are committed, nothing else is modified or untracked).
  - Ensure all tests pass, ask the user if questions arise.
  - **HARD STOP:** After finishing this task, STOP and reply with exactly "checkpoint 16 done". Do not start any further task until the user says "weiter". After "weiter", record the final verdict in the Notes and commit only that edit with `docs(visual-polish-2): record final review verdict`; `git status` is clean again afterwards.

## Notes

- Only the group "Extra polish" (task 14) is optional. Every other task, including all tests, is required.
- One commit per leaf task, with the message given in the task. A task is done only when `pnpm -r typecheck`, `pnpm -r test` and `pnpm e2e` are green.
- Hard stops: tasks 5, 8, 10, 12 and 16 (the final checkpoint). Each reply is exactly "checkpoint N done", then wait for "weiter".
- The 1600x900 references are regenerated at the end of every look-changing task and ratified at the next checkpoint. The two 1440x900 references stay skipped from task 1.2 to task 15.1 (A7).
- `review/` PNGs are tracked in git (the design says so). Older checkpoint images may be deleted after acceptance if the folder grows too large.
- Design risks to watch at checkpoints: the 1.5-point margin on the 90 % skeleton height, the notch fillet seam, the CSS meter face and film backdrop (fallback webp files, D4), card height at 1280x720 (156 u budget against 138 u content), screenshot blur flakes (the 1600 spec may use `maxDiffPixelRatio: 0.002`, with a comment).
- Existing tests are edited only where a task says so, in the same commit as the code that forces the change.

### Review verdicts

- Checkpoint 5: accepted with two changes (film fills the panel, paper 65-70 percent of film width, 24 px film margin, faint CSS X-ray texture; marks nearly invisible at rest, hug the text, full cyan on hover).
- Checkpoint 8: accepted with three changes (meter as tall as the dial and centred on it, 16 px steel below, labels on one baseline, numbers >= 11 px; silver metal toggle lever; v1/v2/v3 on a tight arc <= 20 px from the dial with ticks, RULE VERSION above the arc).
- Checkpoint 10: accepted with two changes (stamp in a reserved empty area, never covers a value or confidence; confidence always on its own line under the value).
- Checkpoint 12: accepted with four changes (start cards: white paper thumbnails with 3-5 real lines, film-sheet cards without hard border and lift/glow on hover/focus; start block centred vertically when the live form is hidden; glass card spacing 12/6 px).
- Checkpoint 16: pending

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["2.1"] },
    { "id": 5, "tasks": ["2.2"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["3.2"] },
    { "id": 8, "tasks": ["4.1"] },
    { "id": 9, "tasks": ["4.2"] },
    { "id": 10, "tasks": ["6.1"] },
    { "id": 11, "tasks": ["6.2"] },
    { "id": 12, "tasks": ["6.3"] },
    { "id": 13, "tasks": ["6.4"] },
    { "id": 14, "tasks": ["6.5"] },
    { "id": 15, "tasks": ["6.6"] },
    { "id": 16, "tasks": ["7.1"] },
    { "id": 17, "tasks": ["7.2"] },
    { "id": 18, "tasks": ["9.1"] },
    { "id": 19, "tasks": ["9.2"] },
    { "id": 20, "tasks": ["9.3"] },
    { "id": 21, "tasks": ["9.4"] },
    { "id": 22, "tasks": ["9.5"] },
    { "id": 23, "tasks": ["11.1"] },
    { "id": 24, "tasks": ["11.2"] },
    { "id": 25, "tasks": ["11.3"] },
    { "id": 26, "tasks": ["13.1"] },
    { "id": 27, "tasks": ["13.2"] },
    { "id": 28, "tasks": ["14.1"] },
    { "id": 29, "tasks": ["15.1"] }
  ]
}
```
