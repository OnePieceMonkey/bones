# Implementation Plan: visual-polish

## Overview

This plan restyles the expense-auditor as the X-ray instrument from `design/mockups/bones-7-retro-b.png`. All look and motion go into `packages/xray-ui`. The app only arranges components. `packages/core` is not touched.

**Hard stops:** Tasks 9, 11 and 13 are hard stops. After finishing such a task, STOP and reply with exactly "checkpoint N done" (N = 9, 11 or 13). Do not start any further task until the user says "weiter". The user reviews the app in the browser during each stop. Task 15 is the final checkpoint without a hard stop; its report ends the run.

Working rules for every task:

- **One commit per task.** Each leaf task states its commit message. Commit only when `pnpm -r typecheck` and `pnpm -r test` are green.
- **The app builds and tests stay green after every commit.** New components are added next to the old ones (design D1). The old `XrayView` stays in use until task 8.3 switches the app to `Shell`.
- **Tests belong with the code they cover.** Tests (including the property tests from the design) are required and are part of the same commit as the task. Nothing is optional except the "Extra polish" group at the end.
- **Tests that must change on purpose change in the same commit as the code that breaks them** (toolbar Overrule, `h1` text, `url()` guards, 18-pair contrast count). No other existing test is edited.
- **No change under `packages/core`.** Task 15 verifies this with `git diff`.
- Every new property test is one test, at least 100 runs, tagged `// Feature: visual-polish, Property N: <text>`, using the existing helpers in `packages/xray-ui/src/__tests__/helpers/`.
- New xray-ui code uses no word from the domain-isolation list (receipt, expense, alcohol, meal, trip, suspect) in `.ts`, `.tsx` or `.css` under `src/`. Use "paper", "document", "amount asked for".

Decisions recorded here:

- **Font:** `Cormorant SC` weight 700 replaces Abril Fatface. Only the latin 700 woff2 file ships (about 20,352 B), through a custom `@font-face` in `packages/xray-ui/src/styles/fonts.css`. The woff file (25,948 B) does not ship, because both files together (46,300 B) exceed the 30,720 B limit. The package CSS is not imported.
- **Existing app tests depend on old DOM details.** `DecisionView` and `App` tests query `button.xr-bone-btn[data-state]`, `role="article"` named "AI answer" containing a `role="note"` with "OVERRULED BY RULE", `.xr-result`, and the text "Expense Auditor - RECORDED". The new components keep these class names, roles and texts so those tests pass without edits. The title plate text moves into a visually hidden element inside `Shell` (task 8.1).
- **`statusNote` strip** (Version note and trip text) is added to `Shell` in task 8.1. If it makes 1280x720 too tight, the trip text becomes a `title` attribute (checked in task 13.2).
- **Leg anchors** `leg-left (44, 58)` and `leg-right (57, 58)` are proposals from the design. They are reviewed on the first screenshot in task 13.3.

## Tasks

- [x] 1. Foundation: assets, guards, dependencies
  - [x] 1.1 Copy assets, typing and asset budget test
    - Copy every file of `design/assets/` byte for byte into `packages/xray-ui/src/assets/` (splinters into `splinters/`). Rename `receipt-paper.webp` to `paper.webp`. Do not import anything from `design/`.
    - Create `src/assets/index.ts`: one named URL export per image (`brushedSteelUrl`, `clipUrl`, `drBonesUrl`, `filmUrl`, `fractureBurstUrl`, `glassCracksUrl`, `knobUrl`, `lampUrl`, `lightConeUrl`, `meterUrl`, `paperUrl`, `screwUrl`, `skeletonUrl`, `stampFrameUrl`, `toggleUrl`, `splinter1Url` to `splinter8Url`) and the derived `SPLINTER_URLS`. No other module exports an image URL.
    - Add `src/vite-env.d.ts` (`/// <reference types="vite/client" />`) and add `vite/client` to `types` in `packages/xray-ui/tsconfig.json`. `tsc --noEmit` must pass in xray-ui and in the app.
    - Add `src/__tests__/assets.test.ts` with a pure `checkAssets(listing, budget)` and tests for: every file in `design/assets/README.md` present (failure message lists each missing name), byte equality with `design/assets/`, no `receipt-paper.webp`, one export per file in `index.ts`, total size at most 1,500,000 B (failure message shows measured bytes and the budget), and a fake-listing unit test for both failure messages.
    - Update `src/__tests__/source-hygiene.test.ts` so `listFiles` skips `src/assets/` (binary files must not be read as UTF-8). All forbidden patterns still apply to every text file. Put a comment above the change that states the reason.
    - The byte-equality test reads `design/assets/`, so `design/assets/` must be in the repo. The commit must add both directories: `git add design/assets packages/xray-ui/src/assets` plus the other files of this task (`index.ts`, `vite-env.d.ts`, `tsconfig.json`, tests). Check with `git status` that no file under `design/assets/` stays untracked or ignored.
    - Commit message: `feat(xray-ui): bundle visual assets with typed URL exports and budget test`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8, 1.9, 19.5_

  - [x] 1.2 Path-aware url and import guard; remove the blanket url() bans
    - Add `src/__tests__/guards/assets-guard.test.ts`. It scans every `.css`, `.ts`, `.tsx` under `src/` (not `__tests__`). Each CSS `url(...)` and each image import (`.webp .png .jpg .jpeg .gif .svg .avif`) must resolve to a file inside `src/assets/`. Targets starting with `http://`, `https://`, `//` or `data:` fail. The guard allows exactly one font file outside `src/assets/`: the `url()` in `src/styles/fonts.css` that points at `@fontsource/cormorant-sc/files/cormorant-sc-latin-700-normal.woff2` (use the real file name confirmed in task 1.5). Any other font file fails. The message names file and line. Add a unit test of the scanning function with bad samples (outside path, remote URL, `//` URL).
    - In `Lightbox.test.tsx` (last test) keep the `@import` check and remove the `url(` check. In `AnswerCard.styles.test.ts` remove the test "uses no url() references". Directly above each changed guard, add a comment of at least one sentence that says why it changed (the new look needs bundled images, and the path-aware guard replaces the blanket ban).
    - Add `src/__tests__/guards/` domain-word coverage check: confirm `domain-isolation.test.ts` still passes with `src/assets/index.ts` and add no change to it.
    - Commit message: `test(xray-ui): replace blanket url() ban with asset-dir guard`
    - _Requirements: 2.3, 2.5, 19.1, 19.2, 19.7, 19.8_

  - [x] 1.3 Motion guard and legacy animation cleanup
    - Add `src/__tests__/guards/motion-guard.test.ts`. `@keyframes`, `animation`, `animation-*` and `transition` are allowed only under `src/styles/`. Each such file needs a reduced-motion override: `animation: none` or `transition: none` inside `@media (prefers-reduced-motion: reduce)` for the selector, or the scoped `.xr-shell[data-motion="reduce"]` and `.xr-shell[data-motion="auto"]` catch-all pair for selectors that start with `.xr-shell`. Animated property names in `@keyframes` bodies and in `transition` values must be in `{transform, opacity, filter}`. Failure messages name file and selector. Add a unit test of the scanner with a bad sample for each rule. Put a comment above the guard that explains why it is new.
    - Rewrite the two legacy rules in `src/styles/xray.css` that animate other properties (`.anim-mark` background and `xr-ecg-scroll` stroke-dashoffset) as equivalent `opacity` and `transform` rules so the guard passes. No existing test may change.
    - Commit message: `test(xray-ui): add motion guard and limit animated properties to transform/opacity/filter`
    - _Requirements: 15.3, 19.3, 19.4, 19.7, 22.1_

  - [x] 1.4 App guard test
    - Add `apps/expense-auditor/tests/guards/no-visual-in-app.node.test.ts`. It scans `apps/expense-auditor/src` (`.ts`, `.tsx`, `.css`) for image imports, `url(`, `@keyframes`, `transition`, `animation`, `style=` on Shell elements, audio patterns (`AudioContext`, `new Audio`) and auth patterns. Failure messages name file and construct. Add a unit test of the scanner with bad samples.
    - Confirm the test passes on the current app source.
    - Commit message: `test(expense-auditor): guard app source against visual constructs, audio and auth`
    - _Requirements: 2.2, 2.4, 2.6, 19.6_

  - [x] 1.5 Pin font and test dependencies; font budget test
    - In `packages/xray-ui` add `@fontsource/cormorant-sc` and `sharp` with `pnpm add --save-exact` (`sharp` as devDependency). `package.json` must show exact versions with no `^` or `~`. Commit the lockfile change.
    - After the install, run `ls node_modules/@fontsource/cormorant-sc/files/ | grep latin-700-normal` and confirm the real woff2 file name (expected `cormorant-sc-latin-700-normal.woff2`, about 20,352 B). Use that exact name in `fonts.css` and in the tests.
    - Add `src/styles/fonts.css` with one custom `@font-face` (`font-family: "Cormorant SC"; font-weight: 700; font-style: normal; font-display: swap`) whose `src` is `url(...)` of the package's `latin-700-normal.woff2` with `format("woff2")`. Ship woff2 only. Do not import the package CSS (`@fontsource/cormorant-sc/*.css`). Task 4.3 imports `fonts.css`.
    - Add `src/__tests__/fonts.test.ts`: exactly 1 font file is referenced by `fonts.css` (the woff2) and no woff, at most 30,720 B. The failure message shows the measured and allowed bytes. Add a test that fails if any `@fontsource/*/*.css` is imported in `src/`. Add a test that reads `package.json` and fails on any `^` or `~` in the `@fontsource/cormorant-sc` and `sharp` entries.
    - Commit message: `chore(xray-ui): pin cormorant-sc font and sharp, add font budget test`
    - _Requirements: 4.1, 4.10, 22.2_

- [x] 2. Pure model with property tests
  - [x] 2.1 Anchor table and placement
    - Add `src/model/anchors.ts` per the design: `CROP`, `ANCHORS` (skull 50/9, ribs 57/29, spine 50/33, pelvis 56/47, arm-right 69/45, arm-left 31/45, leg-left 44/58, leg-right 57/58), `SPINE_LOWER` (50, 42), `LATTICE_STEP`, `MIN_SEPARATION`, `placeBones`, `toCropPercent`. Pure: no `Date`, no `Math.random`.
    - Add `src/__tests__/properties/anchors.test.ts`.
    - **Property 1: Anchor mapping is deterministic and depends only on region order**
      - **Validates: Requirements 10.3, 10.6, 10.7, 10.15**
    - **Property 2: Hotspot positions are distinct, anchored and inside the crop**
      - **Validates: Requirements 10.1, 10.2, 10.4, 10.5**
    - Add example tests for the README anchor values and for two spine bones at (50, 33) and (50, 42).
    - Commit message: `feat(xray-ui): add anchor table and deterministic bone placement`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 2.2 Hotspot state and splinter file choice
    - Add `src/model/hotspotState.ts` (`hotspotState(bone)`) and `src/model/splinterAssets.ts` (6 distinct indexes in 0..7 using the existing `hashString` and `nextRandom`, partial Fisher-Yates).
    - Add `src/__tests__/properties/splinter-assets.test.ts`.
    - **Property 4: Splinter file choice is deterministic and distinct**
      - **Validates: Requirements 10.10, 10.15**
    - Add unit tests for the four `hotspotState` outcomes.
    - Commit message: `feat(xray-ui): add hotspot state mapping and deterministic splinter choice`
    - _Requirements: 10.8, 10.9, 10.10, 10.11, 10.15_

  - [x] 2.3 Progress share and result line
    - Add `src/model/progress.ts` (`progressShare`, `resultLine`). `claimed <= 0` or non-integer gives 0, never `NaN`.
    - Add `src/__tests__/properties/progress.test.ts`.
    - **Property 6: Progress share is bounded and monotonic**
      - **Validates: Requirements 8.6, 8.7**
    - **Property 7: Result line format**
      - **Validates: Requirements 8.5**
    - Add a unit test for "PARTIALLY APPROVED $41.50".
    - Commit message: `feat(xray-ui): add progress share and result line model`
    - _Requirements: 8.5, 8.6, 8.7_

  - [x] 2.4 Intro schedule
    - Add `src/model/introSchedule.ts` with `INTRO` constants and `introSchedule(fractured)` as in the design (start 1500, window 800, max step 250, end at most 3500, `[]` gives `{ starts: [], endMs: 0 }`).
    - Add `src/__tests__/properties/intro-schedule.test.ts`.
    - **Property 10: Intro schedule order and duration**
      - **Validates: Requirements 12.1, 12.2**
    - Add unit tests for n = 1, n = 5 and n = 20 (last fractured end 3498).
    - Commit message: `feat(xray-ui): add intro schedule model`
    - _Requirements: 12.1, 12.2_

  - [x] 2.5 Fracture diff
    - Add `src/model/fractureDiff.ts` (`newlyFractured(prev, next)`, bone key `${ruleId}:${index}`).
    - Add `src/__tests__/properties/fracture-diff.test.ts`.
    - **Property 16: Fracture moments play only for newly fractured bones**
      - **Validates: Requirements 13.6**
    - Commit message: `feat(xray-ui): add newly-fractured diff model`
    - _Requirements: 13.6_

  - [x] 2.6 Needle swing
    - Add `src/model/needleSwing.ts` (`needleSwing(prev, next)`, overshoot is 10 % of travel clamped to 1..8 degrees, `over === to` when `from === to`).
    - Add `src/__tests__/properties/needle-swing.test.ts`.
    - **Property 15: Needle swing overshoots by 1 to 8 degrees**
      - **Validates: Requirements 14.5**
    - Commit message: `feat(xray-ui): add needle swing model`
    - _Requirements: 14.5_

  - [x] 2.7 Rule box placement
    - Add `src/model/ruleBoxPlacement.ts` (`placeRuleBox`, GAP 24 px, side choice, clamping, line from nearest box point to the hotspot centre).
    - Add `src/__tests__/properties/rule-box-placement.test.ts`.
    - **Property 8: Rule box placement stays inside the lightbox and joins the bone**
      - **Validates: Requirements 11.2, 11.5**
    - Commit message: `feat(xray-ui): add rule box placement model`
    - _Requirements: 11.2, 11.5_

  - [x] 2.8 Motion mode resolution
    - Add `src/model/motion.ts` (`MotionMode`, `motionMode(prop)`, `isReduced(prop, media)`). Do not change the existing `useReducedMotion` hook behaviour or its tests.
    - Add unit tests for the 6 combinations of the table in the design (prop true, false, undefined x media).
    - Commit message: `feat(xray-ui): add motion mode resolution model`
    - _Requirements: 15.5, 15.6_

- [x] 3. Contrast tokens
  - [x] 3.1 New tokens and contrast test extension
    - Add the new tokens to `src/styles/tokens.css` (glass tint and alpha, text and background pairs for glass, header, sheet, bubble, phone head, footer, rule box, paper document, steel plaque, stamp, focus contrast, amber glow). Text and background colours the test reads are six-digit hex. `--xr-glass-alpha` is a plain number.
    - In `contrast.test.ts` keep the existing 18 pairs unchanged in `TOKEN_PAIRS`. Add `NEW_PAIRS` with exactly the 11 surfaces of the design and `FOCUS_PAIRS` (`--xr-focus` vs `--xr-focus-contrast` and vs the four dark backgrounds, at least 3:1). Replace the assertion `toHaveLength(18)` with `at least 29 text pairs` in the same commit, and add a comment above it that states why. Failure messages: `"<pair>: <ratio 2 decimals> < <required>"` and `"missing token <name>"`.
    - Add a `blend(tint, alpha, backdrop)` helper in the test helpers. Scan `film.webp` with `sharp(...).raw()` for the lightest and darkest pixel by relative luminance. The glass pairs use `glassBackdrop(pixel)`. The document pair uses the worse of the token and the darkest opaque `paper.webp` pixel.
    - **Property 19: Contrast pairs meet WCAG**
      - **Validates: Requirements 7.8, 8.11, 9.13, 11.7, 18.1, 18.2, 18.3, 6.8**
    - Include the property that `blend` returns a channel between the two inputs for any tint, alpha in [0, 1] and backdrop. Add unit tests for the two failure messages.
    - Commit message: `feat(xray-ui): add contrast tokens and extend contrast test to 29 text pairs`
    - _Requirements: 6.8, 7.8, 8.11, 9.13, 11.7, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [x] 4. Layout work: frame, header, lightbox
  - [x] 4.1 AssetImage
    - Add `components/shell/AssetImage.tsx`: always sets positive integer `width` and `height`, never sets `loading`, `alt=""` plus `aria-hidden="true"` by default, `onError` sets `data-failed="true"`. Add `styles/shell.css` with `[data-failed="true"] { visibility: hidden; }`. Import the CSS from `src/index.ts`.
    - Add `components/AssetImage.test.tsx`: attributes, error handling keeps the element and sets `data-failed`, no `loading` attribute.
    - Commit message: `feat(xray-ui): add AssetImage with fallback on load error`
    - _Requirements: 1.6, 13.8, 17.3, 22.4_

  - [x] 4.2 SteelFrame
    - Add `components/shell/SteelFrame.tsx` and `styles/frame.css`: `brushed-steel.webp` tiled 512 px, solid fallback colour, inner bevel (one inset highlight and one inset shadow), exactly four `screw.webp` spans (`aria-hidden`) with fixed rotations 12, 97, 188, 271 degrees.
    - Add `components/SteelFrame.test.tsx`: four screws, four distinct rotations, `aria-hidden`, the frame renders its children.
    - Commit message: `feat(xray-ui): add brushed-steel frame with screws and bevel`
    - _Requirements: 5.1, 5.2, 5.3, 5.8, 17.3_

  - [x] 4.3 HeaderBar and HeaderAction with font
    - Add `components/shell/HeaderBar.tsx`, `HeaderAction.tsx` and `styles/header.css`. Grid `1fr auto 1fr`: wordmark "BONES" and tagline "the skeleton under every AI decision" on the left (gap 8 to 24 px), pill "X-RAY ON" or "X-RAY OFF" centred, `headerActions` right. Wordmark font `"Cormorant SC", Georgia, serif` with `font-weight: 700`. Action font smaller and lighter than the wordmark.
    - Import `./styles/fonts.css` (from task 1.5) in `src/index.ts`. Do not import any package CSS.
    - Add `components/HeaderBar.test.tsx`: wordmark, tagline, pill text for on and off (and "X-RAY ON" is gone when off), actions render on the right and call their handlers on click and on Enter and Space.
    - Commit message: `feat(xray-ui): add header bar with self-hosted wordmark font`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.9, 4.10_

  - [x] 4.4 Lightbox film, light cone and flat view
    - Extend `Lightbox` with props `pill?: boolean` and `plate?: boolean`, both default `true`, so the existing `Lightbox.test.tsx` passes unchanged. With `plate={false}` the title becomes only `aria-label`.
    - In `styles/stage.css` set `.xr-viewport` background to `film.webp` cover with a solid `#05090d` fallback, the light cone as `::before` (`light-cone.webp`, top centre, `mix-blend-mode: screen`), and the flat view (`data-xray="false"`) with no film, no blend, no glow and the same size.
    - Add tests: with `pill={false}` and `plate={false}` neither renders; defaults keep the old DOM; flat view sets `data-xray="false"`.
    - Commit message: `feat(xray-ui): add film background, light cone and flat view to Lightbox`
    - _Requirements: 5.4, 5.5, 5.7, 5.8, 5.9_

  - [x] 4.5 ShellFrame with scaling and reduced-motion scope
    - Add `components/shell/ShellFrame.tsx` and `styles/shell.css` additions. Props per the design (`heading`, `xray`, `headerActions`, `lightboxLabel`, `controls`, `children`, `introPhase`, `reducedMotion`). Renders one visually hidden `h1` with `heading`, the header, the steel frame and the lightbox. Root `.xr-shell` is `position: fixed; inset: 0; min-width: 1280px; min-height: 720px` with `--xr-u: min(100vw / 1280, 100vh / 720)`. Page scrolls below 1280x720 and not above. Lightbox grid: columns 28fr 46fr 26fr, rows 62fr 38fr, areas `doc stage doctor` and `ctrl stage doctor`.
    - Resolve Reduced_Motion with `isReduced`. Set `data-motion` (`reduce`, `full`, `auto`), add class `xr-live` only when not reduced, and `data-intro`. Add the three reduced-motion CSS layers from the design (prop true, media query only for `data-motion="auto"`).
    - Add `components/ShellFrame.test.tsx` and `properties/motion-resolution.test.tsx`.
    - **Property 12: Reduced-motion resolution**
      - **Validates: Requirements 8.3, 12.6, 15.1, 15.2, 15.4, 15.5, 15.6, 15.7** At this stage assert `data-motion`, absence of `.xr-live` and `anim-` classes and `data-intro="done"` on the first render. Extend the property in task 10.8 with chat text and hotspot checks.
    - Unit tests: exactly one `h1`, hidden visually but present in the accessibility tree.
    - Commit message: `feat(xray-ui): add ShellFrame with one-screen scaling and motion scope`
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 4.8, 15.4, 15.5, 15.6, 15.7_

- [x] 5. Layout work: document, glass card, doctor panel
  - [x] 5.1 DocumentPanel and scan line
    - Add `components/panels/DocumentPanel.tsx` wrapping `FilmClip`. `paper.webp` strip with cream fallback, two `clip.webp` clips at the top corners (reuse the `.xr-clip--left` and `--right` spans), scrollable monospace text area (`tabIndex={0}`, `role="region"`), image source shown on the paper. Add the optional prop `scanOverruled?: boolean` (default `false`, old DOM unchanged) to `FilmClip`: a `.xr-scan` child for each overruled field with a known `line` or `bbox` source, nothing for unknown sources. Add `styles/panels.css` (mark fade by opacity, 150 ms).
    - Add `properties/glass-document.test.tsx` part for the document.
    - **Property 18: Document marks follow the hovered rule**
      - **Validates: Requirements 6.3, 6.5, 6.6, 11.8**
    - Unit tests: exactly two clips, text scroll region, image source, existing `FilmClip.test.tsx` passes unchanged.
    - Commit message: `feat(xray-ui): add DocumentPanel with paper, clips and scan lines`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 5.2 GlassCard, cracks and overrule stamp
    - Add `components/panels/GlassCard.tsx` reusing the `AnswerCard` row markup. Keep `role="article"` named "AI answer" and the stamp as `role="note"` containing "OVERRULED BY RULE" so existing app tests stay valid. Frosted surface with `backdrop-filter: blur(10px)` and an `@supports not` opaque fallback. `glass-cracks.webp` with `mix-blend-mode: screen`, `pointer-events: none`, only when a field is overruled. One stamp with `stamp-frame.webp` (CSS dashed border fallback), rotation -8 degrees, live text "OVERRULED BY RULE" plus label and version of the first overruled bone in anatomy order. Linked rows get `data-linked="true"` for the hovered rule.
    - Extend `properties/glass-document.test.tsx`.
    - **Property 17: Glass card shows cracks and exactly one stamp when something is overruled**
      - **Validates: Requirements 7.3, 7.4, 7.5, 7.6, 7.9**
    - Unit tests: no cracks and no stamp when nothing is overruled; stamp rotation magnitude between 5 and 12; blur radius between 4 and 16 in the CSS; `AnswerCard` tests and style test unchanged and green.
    - Commit message: `feat(xray-ui): add GlassCard with cracks and overrule stamp`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.9, 11.8_

  - [x] 5.3 Extract ChatLog from DrBonesChat
    - Move the message list and typewriter logic of `DrBonesChat` into `components/chat/ChatLog.tsx`. `DrBonesChat` imports it. Behaviour, class names and DOM do not change. No test file changes.
    - Add a direct unit test of `ChatLog` (full text at once when Reduced_Motion is true, text typed otherwise).
    - Commit message: `refactor(xray-ui): extract ChatLog from DrBonesChat without behaviour change`
    - _Requirements: 8.2, 8.3, 8.4_

  - [x] 5.4 ResultFooter
    - Add `components/panels/ResultFooter.tsx`: `role="status"` with `class` `xr-result` (kept for existing app tests), result line from `resultLine` with the amount formatted by `anatomy.formatValue`, a `role="progressbar"` with `aria-valuemin` 0, `aria-valuemax` 100, `aria-valuenow` = `round(100 * share)` and a fill using `transform: scaleX(share)`. Buttons "Replay decision" and "Human override" call `onReplay` and `onOverride` once per activation; `overrideRef` points to the override button. With `effective`: effective result, "overruled by {reviewerName}" and "Rules decided: ..." as `ResultPlate` shows today.
    - Add `components/ResultFooter.test.tsx` and extend `properties/progress.test.ts` with the rendered check of Property 6 (`aria-valuenow`).
    - Unit tests: claimed 0 gives 0 % and no `NaN`; callbacks once; override text.
    - Commit message: `feat(xray-ui): add ResultFooter with progress bar and action buttons`
    - _Requirements: 8.5, 8.6, 8.7, 8.8, 8.9, 8.12_

  - [x] 5.5 DoctorPanel
    - Add `components/panels/DoctorPanel.tsx` and CSS: rounded phone shell, notch, header with `dr-bones.webp` circular crop (`AssetImage`, 512x512) and "Dr. Bones", body `role="log"` and `aria-live="polite"` with `overflow-y: auto` and `min-height: 0` rendering `ChatLog` from `buildChatMessages`, then `ResultFooter`. Text only from the chat builder and fixed templates.
    - Add `components/DoctorPanel.test.tsx`: header text, avatar is decorative or named, log role, messages typed or shown at once by Reduced_Motion, footer present, buttons wired. Existing `chat-source.test.tsx` and `DrBonesChat.test.tsx` stay green.
    - Commit message: `feat(xray-ui): add phone-shaped DoctorPanel`
    - _Requirements: 3.5, 8.1, 8.2, 8.3, 8.4_

- [x] 6. Layout work: control panel
  - [x] 6.1 Knob
    - Add `components/panel/Knob.tsx`: `role="slider"`, `aria-label="RULE VERSION"`, `aria-valuemin` 0, `aria-valuemax` count-1, `aria-valuenow` index, `aria-valuetext` label, `knob.webp` rotated with `knobAngle`, "v1/v2/v3" as real text on a circle, click targets per label, key handling via the existing `stepVersion` (call `onVersionChange` once only when the result is non-null, `preventDefault`).
    - Add `properties/controls.test.tsx` with the knob part.
    - **Property 13: Knob keyboard and aria**
      - **Validates: Requirements 9.3, 9.4, 9.5**
    - Commit message: `feat(xray-ui): add Knob with image, labels and keyboard control`
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 17.1_

  - [x] 6.2 Meter
    - Add `components/panel/Meter.tsx`: `meter.webp`, SVG needle and pivot, `role="meter"`, `aria-label="AI READ CONFIDENCE"`, 0 to 100, `aria-valuenow = round(100 * value)` with `aria-valuetext` "confidence 0.87", no `aria-valuenow` and "no confidence available" when there is no value, needle angle from `needleAngle` via `buildGaugeModel`. `GaugeControl` and its test stay untouched.
    - Extend `properties/controls.test.tsx`.
    - **Property 14: Meter value and needle angle**
      - **Validates: Requirements 9.6, 9.7, 9.8**
    - Commit message: `feat(xray-ui): add Meter with 0-100 scale and SVG needle`
    - _Requirements: 9.6, 9.7, 9.8, 17.1_

  - [x] 6.3 Toggle and Lamp
    - Add `components/panel/Toggle.tsx` (`<button role="switch" aria-checked>` with `toggle.webp`, `scaleY(-1)` when on) and `Lamp.tsx` (`lamp.webp`; on: `filter: brightness(1.6) drop-shadow(0 0 calc(10 * var(--xr-u)) var(--xr-amber-glow))`; off: `brightness(0.8)` and no `drop-shadow`). Lamp is decorative.
    - Add `components/Toggle.test.tsx`: `aria-checked` true and false, lever transform class, lamp filter values on and off in the CSS source, name is non-empty.
    - Commit message: `feat(xray-ui): add Toggle switch and amber Lamp`
    - _Requirements: 9.9, 9.10, 9.11, 9.12, 17.1_

  - [x] 6.4 ControlPanel assembly
    - Add `components/panel/ControlPanel.tsx` and `styles/controls.css`: brushed-steel background, four screws, labels "RULE VERSION", "AI READ CONFIDENCE", "X-RAY" on plaques that use the contrast tokens, overlap with the frame through negative margins (`calc(-18 * var(--xr-u))`) in grid area `ctrl`, never reaching the stage column. Tab order: Knob, then Toggle.
    - Add `components/ControlPanel.test.tsx`: four screws, labels as text, Knob and Toggle wired to the callbacks, tab order, Meter value from the trace confidence.
    - Commit message: `feat(xray-ui): add steel ControlPanel with knob, meter and toggle`
    - _Requirements: 9.1, 9.13, 17.4_

- [x] 7. Layout work: stage with static hotspots
  - [x] 7.1 SkeletonPhoto and photo box
    - Add `components/stage/SkeletonPhoto.tsx` and CSS: the stage cell is `container-type: size`; the photo box is `width: min(100cqw, 100cqh * 1.0824)` with `aspect-ratio: 1208 / 1116`, centred; `skeleton.webp` as `AssetImage` with `position: absolute; width: 100%; height: 161.29%; top: -4.839%` and `mix-blend-mode: screen`.
    - Add `components/SkeletonPhoto.test.tsx`: image attributes, crop style constants match `CROP` (3 to 65), failed image keeps the box.
    - Commit message: `feat(xray-ui): add cropped skeleton photo box`
    - _Requirements: 5.6, 5.8, 10.7_

  - [x] 7.2 Stage with static hotspots
    - Add `components/stage/Hotspot.tsx` (wraps the existing `BoneButton`, keeps class `xr-bone-btn`, `data-state` and the aria-label from `boneAriaLabel`) and `Stage.tsx`. Stage computes `selectBones`, `placeBones`, positions each hotspot at its anchor in percent of the crop box (`toCropPercent`), sets the hovered rule via the existing context on pointer enter, leave, focus and blur, and handles Escape with `dismissedRuleId` as `Skeleton` does. States: passed (cyan ring), applied-no-change (ring plus one check), fractured (red ring), not-applicable (dim ring). Focus ring: 3 u outline with a 5 u contrast shadow. Burst, splinters and the rule box come in task 10.
    - If existing app tests rely on tooltips, mount the existing `Tooltip` for now. Task 10.2 replaces it.
    - Add `properties/hotspot.test.tsx`.
    - **Property 3: Hotspot visual state follows the bone state**
      - **Validates: Requirements 10.8, 10.9, 10.10, 10.11** In this task assert `data-state`, ring class, check count, and that `passed` and `not-applicable` have no burst or splinter. The fractured burst and splinter counts are added in task 10.1.
    - **Property 5: Every hotspot has a complete accessible name**
      - **Validates: Requirements 10.13, 17.5**
    - Unit test: exactly one hotspot per bone; focus ring CSS present.
    - Commit message: `feat(xray-ui): add Stage with anchored static hotspots`
    - _Requirements: 10.3, 10.8, 10.9, 10.11, 10.13, 10.14, 17.2, 17.5_

- [x] 8. Layout work: Shell and app rewiring
  - [x] 8.1 Shell assembly
    - Add `components/shell/Shell.tsx` with `ShellProps` from the design plus `statusNote?: ReactNode` (one-line strip under the lightbox, `aria-live="polite"`). One `HoveredRuleProvider`. Compose `ShellFrame`, `DocumentPanel`, `GlassCard`, `Stage` (flat view when `xray` is false: the stage is not mounted, content shown flat), `DoctorPanel`, `ControlPanel`. `Shell` never evaluates rules. Keep the title plate text ("Expense Auditor - RECORDED" as passed by the app through `lightboxLabel`) also as a visually hidden element so the existing `getByText` assertion passes. Export all new components and types from `src/index.ts`.
    - Add `properties/images.test.tsx`.
    - **Property 20: Images are declared, sized and described**
      - **Validates: Requirements 1.6, 17.3, 22.4**
    - **Property 21: Render determinism**
      - **Validates: Requirements 20.4**
    - Add a `Shell` test with failing stubs for fetch, XHR, WebSocket and audio: zero calls (extend the pattern of `no-network.test.tsx`). Add a tab-order test: header actions, document, hotspots, doctor buttons, control panel.
    - The app does not use `Shell` yet, so the app suite is unaffected.
    - Commit message: `feat(xray-ui): add Shell composing all panels, stage and controls`
    - _Requirements: 2.4, 3.4, 5.7, 17.4, 20.4, 20.6_

  - [x] 8.2 Selector and toolbar change
    - Add `claimedCentsOf(trace)` to `apps/expense-auditor/src/state/selectors.ts` (reads `claimedTotalCents` through `isRuleFields`, `0` when the shape is invalid) with a unit test.
    - Change `Toolbar.tsx`: render two `HeaderAction` buttons "Download trace" and "Load another receipt" with the same handlers; remove the "Overrule" button and the `onOverrule` and `overruleRef` props; keep `role="toolbar"` named "Decision actions".
    - In the same commit update `tests/components/Toolbar.test.tsx`: the button list becomes `["Download trace", "Load another receipt"]` and the Overrule tests are removed from this file (the override flow is covered at `DecisionView` level in task 8.3). Because `DecisionView` still passes the removed props, adjust `DecisionView.tsx` in this commit so it keeps the app working: it renders its own temporary "Overrule" button next to the toolbar until task 8.3 replaces it, so `App.test.tsx` and `DecisionView.test.tsx` stay green without edits.
    - Commit message: `feat(expense-auditor): move Overrule out of the toolbar and add claimedCentsOf`
    - _Requirements: 4.5, 4.6, 8.10, 20.5_

  - [x] 8.3 DecisionView on Shell
    - Replace `XrayView` with `Shell` in `DecisionView.tsx`: `heading="Expense Auditor"`, `lightboxLabel={titlePlate(origin)}`, `introKey={state.sessionId}`, `claimedCents={claimedCentsOf(trace)}`, `headerActions={<Toolbar .../>}`, `onOverride` opens the existing dialog, `overrideRef`, `statusNote` carrying `VersionNote` and the trip text. Remove the temporary "Overrule" button from task 8.2 and the visible `h1` and plate. `App.tsx` keeps looking up the `h1` for focus; the bundle-error branch keeps its plain `<h1>`.
    - Remove `.app-start`, `.app-decision`, `.app-plate` and `.app-toolbar` rules from `app.css`. No `url()`, `@keyframes`, `transition` or inline style in the app (the app guard from task 1.4 must pass).
    - In the same commit update the two `DecisionView.test.tsx` lines and the `App.test.tsx` lines that click or focus "Overrule" so the target is the button named "Human override". No other test changes. `OverrideDialog.test.tsx` uses its own harness button and stays unchanged.
    - Run the recorded parity, export and intro tests: they must pass without edits (R20.2, R12.7).
    - Commit message: `feat(expense-auditor): render decision view on Shell with Human override button`
    - _Requirements: 2.2, 2.4, 4.6, 4.7, 4.8, 8.10, 12.7, 20.2, 20.5_

- [x] 9. Checkpoint - layout work
  - Ensure all tests pass, ask the user if questions arise.
  - Run `pnpm -r typecheck` and `pnpm -r test`. Confirm the app builds with `pnpm --filter @bones/expense-auditor build`.
  - **HARD STOP:** After finishing this task, STOP and reply with exactly "checkpoint 9 done". Do not start any further task until the user says "weiter". The user reviews the app in the browser.

- [x] 10. Bones and motion
  - [x] 10.1 Fracture visuals on hotspots
    - Extend `Hotspot` for the fractured state: a `.xr-fx` group with `.xr-hs-flash`, `fracture-burst.webp` (`mix-blend-mode: screen`), 6 splinters from `splinterAssets(ruleId)` with `--dx` and `--dy` custom properties (precomputed from the existing `splinters()` model, 2 decimals), and the red pulsing ring (CSS gradient, so the glow stays if images fail). Reduced motion or no `.xr-live`: static red glow, burst at scale 1, splinters at the fly-out point with opacity 0.7. Add the matching rules to `styles/stage.css`. Do not add any keyframes yet.
    - Extend `properties/hotspot.test.tsx`.
    - **Property 3: Hotspot visual state follows the bone state**
      - **Validates: Requirements 10.8, 10.9, 10.10, 10.11** Add the checks that a fractured hotspot has one burst and 6 to 8 splinters and that the other states have none.
    - Unit tests: failed burst keeps the ring and the accessible name; rendering the same trace twice gives identical DOM.
    - Commit message: `feat(xray-ui): add fracture burst and splinters to hotspots`
    - _Requirements: 10.10, 10.12, 10.15, 10.16, 13.7, 13.8_

  - [x] 10.2 Rule box with line to the bone
    - Add `hooks/useElementRect.ts` (layout effect plus `ResizeObserver` guarded by `typeof ResizeObserver === "function"`) and `components/stage/RuleBox.tsx` (`role="tooltip"`, id from `tooltipId(ruleId)`, head "{ruleId} v{version}", state text, `renderedMessage`, `<dl>` of `evidenceRows`, `<p class="xr-rb-empty">No evidence recorded</p>` when there are no rows) and an SVG line (stroke width 1.5, `aria-hidden`). Position from `placeRuleBox`. With all-zero rects (jsdom) render without position and without the line. Show and hide with an `opacity 80ms` transition. The hotspot gets `aria-describedby` only while the box is open. Focus never moves. Escape hides the box. Remove the temporary `Tooltip` mount from task 7.2. Highlights of linked fields in `DocumentPanel` and `GlassCard` come from the hovered rule.
    - Add `properties/rule-box.test.tsx`.
    - **Property 9: Rule box content is complete**
      - **Validates: Requirements 11.1, 11.9**
    - Unit tests: hover and focus open, leave, blur and Escape close, `aria-describedby` set and removed, focus unchanged, line present when rects are mocked, empty-evidence text. Property 8 is already covered by task 2.7.
    - Commit message: `feat(xray-ui): add rule box with line to the hovered bone`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 17.6, 17.7_

  - [x] 10.3 ECG band
    - Add `components/stage/EcgBand.tsx`: calls the unchanged `buildEcgModel` with bones whose `position.x` is replaced by `xPct / 100 * ECG.width`. Renders the glowing line, the red `spikePath`, an `.xr-ecg-head` element and a visually hidden summary like `EcgLine`. Rejected results render a flat line with no head movement. Position at `top: calc((50 - 3) / 62 * 100%)` of the photo box. Mount it in `Stage`.
    - Add `components/EcgBand.test.tsx`: spike x positions line up with hotspot x percent, flatline for rejected, summary text, `EcgLine.test.tsx` and `ecg-model.test.ts` unchanged.
    - Commit message: `feat(xray-ui): add ECG band aligned to hotspots`
    - _Requirements: 13.4, 13.5, 14.3_

  - [x] 10.4 Intro timeline
    - Add `hooks/useIntro.ts` (`"idle" | "running" | "done"`, state stored as `{ key, phase }`, derived `"running"` on the first render with `xray` true for a new `introKey`, one `setTimeout(endMs)` cleared on cleanup, `"done"` on the first render when Reduced_Motion). Evaluate order in `Stage`: sort bones by the index of the first matching `ruleOutcomes` entry, not-applicable bones last in anatomy order (stable). Pass `--xr-t-light` per hotspot and set `data-intro` on the shell.
    - Add `styles/intro.css` with all intro `@keyframes` (film flicker 0..350 ms, cone fade 250..800, scan sweep 800..1500, hotspot light-up, all with `animation-fill-mode: both`), selectors under `.xr-shell.xr-live[data-intro="running"]`, timing exposed as custom properties on the root. Only `transform`, `opacity`, `filter`. Intro and idle animation sit on different elements.
    - Add `properties/intro.test.tsx` (fake timers) and `css-constants.test.ts` (intro part: parsed CSS constants equal `INTRO`).
    - **Property 11: The intro plays once per case**
      - **Validates: Requirements 12.3, 12.4, 12.8**
    - Unit tests: order, last step at most 3500 ms, Reduced_Motion first frame is final.
    - Commit message: `feat(xray-ui): add one-shot intro timeline`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.8_

  - [x] 10.5 Fracture moment and shake
    - Add `hooks/useFractureBatches.ts` (previous fractured set in a ref, `fxKey` per bone incremented only by `newlyFractured`, one shake class per batch alternating `xr-shake-a` and `xr-shake-b`). Render the fracture group with `key={fxKey}`. Add the fracture `@keyframes` to `styles/intro.css` or `styles/motion.css`: flash 200 ms, burst scale-in 400 ms, splinters fly 800 ms starting at 100 ms ending at opacity 0, red pulse 1.4 s infinite, ECG spike fade in 100 ms, shake at most 300 ms with `translate3d` within 4 px that ends at 0. All end by 900 ms (limit 1200 ms). The intro triggers the moment through the same CSS delay.
    - Extend `css-constants.test.ts`: shake amplitude at most 4 px and duration at most 300 ms, fracture effects end by 1200 ms, only allowed properties.
    - Add unit tests with a version change: a newly fractured bone remounts its group and a bone fractured in both versions does not; one shake class per batch.
    - Commit message: `feat(xray-ui): add fracture moment, splinter flight and lightbox shake`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

  - [x] 10.6 Idle motion
    - Add idle `@keyframes` to `styles/motion.css`: skeleton `filter: brightness()` 0.95 to 1.05 over a 4 s cycle, `.xr-cone-flicker` child with opacity steps no larger than 0.09 within 0 to 1 over 5 s, `.xr-ecg-head` `translateX(-10%)` to `translateX(100%)` over 3.2 s linear infinite. Selectors only under `.xr-shell.xr-live[data-xray="true"]`. Nothing runs when the toggle is off or Reduced_Motion is true.
    - Extend `css-constants.test.ts`: brightness range, 4 s cycle (tolerance 0.2 s), flicker step at most 0.1, ECG vertical position 50 % within 1 %, selectors are scoped.
    - Commit message: `feat(xray-ui): add idle brightness, cone flicker and ECG sweep`
    - _Requirements: 14.1, 14.2, 14.3, 14.7, 14.8_

  - [x] 10.7 Control motion
    - Add control motion to `styles/controls.css` and `styles/motion.css`: knob `transform 350ms cubic-bezier(.3,1.4,.5,1)`, needle animation `xr-needle-swing` (700 ms) driven by `--from`, `--over`, `--to` from `needleSwing(prev, next)` with the needle keyed on `value` and `prev` kept in a ref starting at `needleAngle(null)`, toggle lever `transform 120ms ease-out`, lamp `filter 300ms ease`. Transitions use the base selectors and are switched off by the `data-motion` rules.
    - Extend `css-constants.test.ts`: knob 200 to 600 ms, needle at most 800 ms, lever at most 150 ms, lamp 150 to 500 ms. Add a unit test that the rendered needle receives `--from`, `--over`, `--to` and that a value change changes the needle key.
    - Commit message: `feat(xray-ui): add knob, needle, lever and lamp motion`
    - _Requirements: 14.4, 14.5, 14.6, 14.7_

  - [x] 10.8 Reduced-motion completion
    - Extend Property 12 in `properties/motion-resolution.test.tsx` to the full `Shell` over generated traces: with Reduced_Motion every chat message is complete on the first render, every hotspot is in its final lit or fractured state, no `.xr-live`, no element with an `anim-` class, the Lightbox has no shake class, and `data-motion` equals `motionMode(prop)`. Use `helpers/matchMedia.ts` for the media query. Also test that changing the prop or the media query changes the value on the next render.
    - Verify `motion-guard.test.ts` passes with the final CSS and that the scoped catch-all covers every `.xr-shell` animation and transition. Fix CSS if a selector has no override.
    - Commit message: `test(xray-ui): cover reduced motion across the whole Shell`
    - _Requirements: 8.3, 10.12, 12.6, 13.7, 14.7, 15.1, 15.2, 15.4, 15.5, 15.6, 15.7, 17.8_

- [x] 11. Checkpoint - bones and motion
  - Ensure all tests pass, ask the user if questions arise.
  - Run `pnpm -r typecheck` and `pnpm -r test`. Confirm the app builds.
  - **HARD STOP:** After finishing this task, STOP and reply with exactly "checkpoint 11 done". Do not start any further task until the user says "weiter". The user reviews the app in the browser.

- [x] 12. Start screen
  - [x] 12.1 FilmSheet and neutral descriptions
    - Add `components/FilmSheet.tsx` and CSS: a `<button type="button" aria-describedby={`${id}-desc`}>` named by its title, one-line description span, `clip.webp` clip, film background, `data-selected` slide (`transform` transition 500 ms), disabled state. It knows no result and no domain words.
    - Add `SAMPLE_FILM_LINES` to `apps/expense-auditor/src/extraction/samples.ts` (neutral descriptions from visible facts, at most 120 characters, no line break). Keep `SAMPLE_BLURBS`.
    - Add `components/FilmSheet.test.tsx` (name, description, disabled blocks `onSelect`, Reduced_Motion has no transition) and an app test `tests/components/FilmSheet.lines.test.ts`.
    - **Property 22: Film sheet text is short and reveals no result**
      - **Validates: Requirements 16.3, 16.4, 16.5**, implemented in the app test over all sample ids, with a check for the words "approved", "rejected", "denied", "capped", "deduct" and the expected result label.
    - Commit message: `feat(xray-ui): add FilmSheet and neutral sample descriptions`
    - _Requirements: 16.3, 16.4, 16.5, 16.9_

  - [x] 12.2 StartScreen on ShellFrame
    - Render `ShellFrame` with three `FilmSheet`s (one per sample), the status text "Reading receipt" while busy, all sheets disabled while busy, and `ErrorPanel`. Remove the visible plate, lead text and trip line. The hidden `h1` comes from `ShellFrame heading`. Failed load: error panel, status removed, sheets enabled, no intro. A second activation while loading is ignored.
    - In the same commit update `tests/components/StartScreen.test.tsx`: the heading test checks the hidden `h1` by role and name, and the plate and explanation assertions are replaced by "three film sheets, each a button named by its title". Keep the `App.test.tsx` start-screen lookups (`group` named "Load sample receipt", buttons by title) working: keep that `role="group"` and label on the sheet container.
    - Commit message: `feat(expense-auditor): show start screen as three film sheets on the shell`
    - _Requirements: 4.7, 4.8, 16.1, 16.2, 16.6, 16.7, 16.8, 16.10_

- [x] 13. Playwright and reference screenshots
  - [x] 13.1 Playwright setup and network spec
    - Add `@playwright/test` to the app devDependencies with an exact pinned version. Add `playwright.config.ts` as in the design (`testDir: "e2e"`, `updateSnapshots: "none"`, `maxDiffPixelRatio: 0.001`, `threshold: 0.2`, `reducedMotion: "reduce"`, 1440x900, `webServer` with `vite preview --host 127.0.0.1 --port 4173 --strictPort`, 60 s timeout). Add scripts `"test:e2e": "vite build && playwright test"`. Exclude `e2e/` from the Vitest include pattern. Add `e2e/network.spec.ts`: all requests go to `127.0.0.1:4173`, none to `/api/`, none to a font host.
    - Commit message: `test(expense-auditor): add Playwright config and network spec`
    - _Requirements: 4.10, 20.6, 21.3, 21.8_

  - [x] 13.2 Layout and scrollbar specs
    - Add `e2e/layout.spec.ts`: for 1280x720, 1280x1080, 1920x720, 1920x1080 and 1440x900, every region (`.xr-doc`, `.xr-glass`, `.xr-photo`, `.xr-doctor`, `.xr-controls`) is inside the viewport, no two overlap except `.xr-controls` with `.xr-steel`, the pill centre is within 2 px of the header centre, and a `setViewportSize` change satisfies the layout again within 100 ms. Add scrollbar asserts at 1440x900 and 1280x720 (`scrollWidth === clientWidth` and `scrollHeight === clientHeight`) for the start screen and the signature case. Check the `statusNote` strip at 1280x720 and apply the `title` fallback from the notes if needed.
    - Commit message: `test(expense-auditor): add layout and scrollbar e2e specs`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.3, 21.5_

  - [-] 13.3 Screenshot specs and reference images
    - Add `e2e/start-screen.spec.ts` (waits for `document.fonts.ready` and the three film sheets, `toHaveScreenshot("start-screen.png")`) and `e2e/signature-case.spec.ts` (clicks the "Signature case" sheet, waits for `.xr-shell[data-intro="done"]` for at most 10 s, `toHaveScreenshot("signature-case.png")`). Generate the references once with `playwright test --update-snapshots` and commit `e2e/__screenshots__/`. Review both images: the leg anchors sit on the thighs (adjust `leg-left` and `leg-right` in `anchors.ts` and the anchor test if not), the glass card is cracked with the stamp, and nothing overlaps. Verify a missing reference fails a normal run.
    - Add a Playwright pixel check in `e2e/signature-case.spec.ts`: after `data-intro="done"` (motion allowed for this test), take a screenshot, read the bounding box of each fractured `.xr-burst`, sample the four box corners from the screenshot pixels and assert none is pure black (`#000000`). This guards against the blend-mode bug where the burst and splinters render as black squares because an ancestor forms a stacking context.
    - Commit message: `test(expense-auditor): add start screen and signature case reference screenshots`
    - _Requirements: 10.2, 21.1, 21.2, 21.4, 21.6, 21.7_

  - **HARD STOP (task 13):** After finishing 13.3 (the last sub-task of task 13), STOP and reply with exactly "checkpoint 13 done". Do not start any further task until the user says "weiter". The user reviews the reference screenshots and the app in the browser before the later tasks.

- [ ] 14. Extra polish (optional)
  - [ ]* 14.1 Demo page for the new look
    - Add the `Shell` to the xray-ui demo (`packages/xray-ui/demo`) with a version knob and a toggle, so the look can be tried without the app. The existing `demo-smoke.test.tsx` must stay green.
    - Commit message: `docs(xray-ui): show the Shell in the demo page`
    - _Requirements: 2.1_

  - [ ]* 14.2 README section for the new look
    - Add a short section to `packages/xray-ui/README.md`: asset set and budget, font choice (Cormorant SC 700, one woff2) and size, `--xr-u` scaling, reduced-motion rules, how to regenerate Playwright references.
    - Commit message: `docs(xray-ui): document assets, scaling and reduced motion`
    - _Requirements: 1.5, 15.5_

- [~] 15. Final checkpoint - full suite
  - Run `pnpm -r typecheck`, `pnpm -r test`, `pnpm --filter @bones/expense-auditor test:e2e` and `git diff --exit-code -- packages/core` against the commit before this feature. All must pass with no changed file under `packages/core`.
  - Confirm no test outside the named exceptions was edited (`git diff --stat` on test files shows only Toolbar, App, DecisionView, StartScreen, Lightbox, AnswerCard.styles, contrast and source-hygiene tests).
  - Ensure all tests pass, ask the user if questions arise.
  - This is the final checkpoint and has no hard stop. Its report ends the run.

## Notes

- Only the group "Extra polish" (14.x) uses optional markers. Every other task, including all tests, is required.
- One commit per leaf task, with the message given in the task. A task is done only when typecheck and the full unit suite are green.
- Font choice: Cormorant SC 700, one woff2 file (about 20,352 B) through a custom `@font-face`, fits the 30,720 B limit.
- Tasks 9, 11 and 13 are hard stops (see the note at the top of the task list).
- Existing tests are edited only where the task says so, in the same commit as the code that forces the change.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4", "1.5"] },
    { "id": 4, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 5, "tasks": ["2.4", "2.5", "2.6"] },
    { "id": 6, "tasks": ["2.7", "2.8"] },
    { "id": 7, "tasks": ["3.1"] },
    { "id": 8, "tasks": ["4.1"] },
    { "id": 9, "tasks": ["4.2"] },
    { "id": 10, "tasks": ["4.3"] },
    { "id": 11, "tasks": ["4.4"] },
    { "id": 12, "tasks": ["4.5"] },
    { "id": 13, "tasks": ["5.1"] },
    { "id": 14, "tasks": ["5.2"] },
    { "id": 15, "tasks": ["5.3"] },
    { "id": 16, "tasks": ["5.4"] },
    { "id": 17, "tasks": ["5.5"] },
    { "id": 18, "tasks": ["6.1"] },
    { "id": 19, "tasks": ["6.2"] },
    { "id": 20, "tasks": ["6.3"] },
    { "id": 21, "tasks": ["6.4"] },
    { "id": 22, "tasks": ["7.1"] },
    { "id": 23, "tasks": ["7.2"] },
    { "id": 24, "tasks": ["8.1"] },
    { "id": 25, "tasks": ["8.2"] },
    { "id": 26, "tasks": ["8.3"] },
    { "id": 27, "tasks": ["10.1"] },
    { "id": 28, "tasks": ["10.2"] },
    { "id": 29, "tasks": ["10.3"] },
    { "id": 30, "tasks": ["10.4"] },
    { "id": 31, "tasks": ["10.5"] },
    { "id": 32, "tasks": ["10.6"] },
    { "id": 33, "tasks": ["10.7"] },
    { "id": 34, "tasks": ["10.8"] },
    { "id": 35, "tasks": ["12.1"] },
    { "id": 36, "tasks": ["12.2"] },
    { "id": 37, "tasks": ["13.1"] },
    { "id": 38, "tasks": ["13.2"] },
    { "id": 39, "tasks": ["13.3"] },
    { "id": 40, "tasks": ["14.1", "14.2"] }
  ]
}
```
