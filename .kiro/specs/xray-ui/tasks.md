# Implementation Plan: packages/xray-ui

## Overview

Build `@bones/xray-ui` in strict dependency order: package setup with an empty Lightbox first, then types and tokens, the pure model layer (one function module per task, each with unit tests), hooks, components in dependency order, property tests P1 to P14, guard tests (domain isolation, contrast, source hygiene, no-network, a11y roles), the demo, the public barrel and the README. Each task ends with a commit. No orphaned code: every module is used by a later task or exported by the barrel.

**Language**: TypeScript 5.4.5 strict, React 18.3.1, pnpm workspace.
**Test runner**: Vitest 1.6.0 on jsdom, Testing Library, fast-check 3.19.0 (min 100 runs per property).
**Pure-logic rule**: all logic lives in `src/model`; components only map view-models to JSX.
**Bug tracking**: If a property test fails, fix the implementation, not the property. Keep a short list of bugs found by property tests in `.kiro/specs/xray-ui/bugs-found.md` (property number, counterexample, root cause, fix).
**Hygiene**: no `Math.random`, no `Date.now`, no network, no canvas, no audio, no domain words in `src/` (outside `__tests__`).

---

## Tasks

- [ ] 1. Package setup and empty Lightbox
  - [ ] 1.1 Create the `packages/xray-ui` package files
    - Create `packages/xray-ui/package.json` exactly as in design.md (name `@bones/xray-ui`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }`, scripts `test`, `test:watch`, `typecheck` = `tsc --noEmit`, `dev`; peerDependencies `react`/`react-dom` `^18.3.1`; dependency `@bones/core: workspace:*`; devDependencies with the exact pinned versions from design.md)
    - Create `tsconfig.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `jsx: react-jsx`, DOM libs, `noEmit`, include `src`, `demo`, `vitest.config.ts`)
    - Create `vitest.config.ts` (react plugin, jsdom, `globals: false`, `css: false`, setupFiles `./src/__tests__/setup.ts`, include `src/**/*.test.{ts,tsx}`)
    - Create `src/__tests__/setup.ts` (jest-dom matchers via `@testing-library/jest-dom/vitest`, `afterEach(cleanup)`)
    - Create `demo/vite.config.ts` with `root` = demo dir, react plugin and `server.fs.allow` = `packages/`
    - Create stub `src/index.ts` (`export {};`)
    - Verify the repo root `package.json` has a `typecheck` script that runs `pnpm -r typecheck`; add it if missing
    - Run `pnpm install` from the repo root
    - _Requirements: 15.1, 15.3, 15.4, 15.5, 15.6, 15.9_
    - Commit: `git add packages/xray-ui pnpm-lock.yaml package.json && git commit -m "chore(xray-ui): scaffold package"`
  - [ ] 1.2 Add an empty Lightbox component with a smoke test
    - Create `src/components/Lightbox.tsx` rendering `<section class="xr-lightbox">` with a frame `div.xr-frame`, an optional title plate `<h2 class="xr-title-plate">` when `title` is given, and `<div class="xr-viewport">{children}</div>`; props `title?`, `children?`, `className?` (no pill yet)
    - Create `src/__tests__/components/Lightbox.smoke.test.tsx` with Testing Library: renders the title and a child
    - Run `pnpm --filter @bones/xray-ui test` and `pnpm typecheck` from the repo root; both must be green
    - _Requirements: 1.2, 1.3, 15.7, 15.8, 18.1_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add empty Lightbox with smoke test"`

- [ ] 2. Shared types, tokens, bug log and test helpers
  - [ ] 2.1 Create `src/types.ts`
    - Define `Region`, `REGIONS`, `AnatomyBone`, `Anatomy`, `BoneState`, `Point`, `Splinter`, `BoneView`, `EvidenceRow`, `FieldView`, `ChatKind`, `ChatMessage`, `GaugeModel`, `EcgModel`, `FilmSource`, `SourceMark` and re-export `Trace`, `DecisionResult` types as in design.md
    - Define all component prop interfaces (`CommonProps`, `LightboxProps`, `SkeletonProps`, `BoneButtonProps`, `BoneGlyphProps`, `TooltipProps`, `EcgLineProps`, `FilmClipProps`, `AnswerCardProps`, `DrBonesChatProps`, `KnobControlProps`, `GaugeControlProps`, `ToggleSwitchProps`, `ControlStripProps`, `ResultPlateProps`, `XrayViewProps`)
    - Import `@bones/core` with `import type` only
    - Make `Lightbox.tsx` use `LightboxProps` (keep `xray` optional until task 13.1)
    - _Requirements: 2.2, 13.4, 15.6_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add shared types"`
  - [ ] 2.2 Create design tokens and the bug log
    - Create `src/styles/tokens.css` with every CSS variable from the Design Tokens block in design.md (colours, text colours, glows, focus, spacing, radius)
    - Create `.kiro/specs/xray-ui/bugs-found.md` with a header, the format `Property N | Counterexample | Root cause | Fix`, and the line `No bugs found yet.`
    - _Requirements: 12.4, 15.1_
    - Commit: `git add packages/xray-ui .kiro/specs/xray-ui/bugs-found.md && git commit -m "feat(xray-ui): add design tokens and bug log"`
  - [ ] 2.3 Create shared test helpers in `src/__tests__/helpers/`
    - `fixtures.ts`: hand-built `Trace` (all fields from core `types.ts`, `traceSchemaVersion: "1"`), `Anatomy` and a `signatureTrace()` mirroring the demo (3 fractured bones)
    - `arbitraries.ts`: fast-check generators `arbRuleId`, `arbRegion`, `arbEffect`, `arbEvidence`, `arbOutcome`, `arbFilmSource`, `arbTraceAndAnatomy` (unique rule ids, subset mapped, extra unmapped outcomes, confidence in [0,1], sources `bbox`/`line`/`undefined`, all three results)
    - `matchMedia.ts`: `installMatchMedia(reduce: boolean)` mock plus restore
    - `netSpy.ts`: stubs for `fetch`, `XMLHttpRequest`, `WebSocket` that throw and record calls, plus restore
    - Add a short sanity test `helpers/arbitraries.test.ts` that generated pairs have unique ids
    - _Requirements: 18.1, 18.2, 18.5, 18.10_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): add shared fixtures and arbitraries"`

- [ ] 3. Pure model layer
  - [ ] 3.1 Implement `src/model/format.ts`
    - `defaultFormat`, `safeFormat(anatomy)`, `resultLabel(result)` exactly as in design.md; `defaultFormat` is total (try/catch around `JSON.stringify`, fallback `String`)
    - _Requirements: 2.16, 8.1, 8.2, 8.3, 8.4, 8.5_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add value formatters"`
  - [ ]* 3.2 Write unit tests for `format.ts`
    - Strings, numbers, objects, `undefined`, cyclic object, symbol; `safeFormat` with absent, throwing and non-string-returning `formatValue`; the three `resultLabel` values and an unknown fallback
    - _Requirements: 2.16, 8.1, 8.2, 8.3, 8.5_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): unit tests for formatters"`
  - [ ] 3.3 Implement `src/model/hash.ts`
    - `SPLINTER_COUNT = 6`, `CRACK_SEGMENTS = 8`, `hashString` (FNV-1a 32-bit), `nextRandom` (xorshift32), `splinters(ruleId)`, `crackPath(seed, width, height)` as in design.md; no `Math.random`
    - _Requirements: 2.8, 5.3, 10.2, 10.3_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add deterministic hash visuals"`
  - [ ]* 3.4 Write unit tests for `hash.ts`
    - Known `hashString` values ("" gives 2166136261, "a" gives 3826002220), splinter count and ranges, crack path starts with `M` and stays inside the box, repeated calls are equal
    - _Requirements: 2.8, 5.3, 10.2_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): unit tests for hash visuals"`
  - [ ] 3.5 Implement `src/model/skeletonLayout.ts`
    - `VIEWBOX`, `REGION_BOXES` (table in design.md), `layoutBone(region, indexInRegion, countInRegion)` with 2-decimal rounding, `chipFor(region)`
    - _Requirements: 2.1, 2.3, 2.12_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add skeleton layout"`
  - [ ]* 3.6 Write unit tests for `skeletonLayout.ts`
    - Single bone sits at box centre on its axis; three bones are evenly spread and strictly ordered; all 8 regions have a box; chip side per region
    - _Requirements: 2.1, 2.3, 2.12_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): unit tests for skeleton layout"`
  - [ ] 3.7 Implement `src/model/selectors.ts`
    - `FRACTURE_EFFECTS`, `isFracture`, `fieldLabel` (own-property check), `selectBones` (first outcome per ruleId, region normalised to `"spine"`, per-region index and count, splinters for fractured), `evidenceRows`, `relatedFields`, `relatedBones`, `overruledFields`, `fieldViews`, `sourceMarks`, `countPassed`
    - _Requirements: 2.2, 2.4, 2.5, 2.6, 2.7, 2.14, 4.6, 4.8, 5.1, 5.2, 5.6, 13.4_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add view-model selectors"`
  - [ ]* 3.8 Write unit tests for `selectors.ts`
    - Passed, not-applicable and fractured states; `conditionMet` true with an unknown effect is not a fracture; unmapped outcome ignored; duplicate outcome ids use the first; evidence rows keep key order and use label fallback; `fieldLabel` ignores prototype keys; overruled map ignores computed keys; `sourceMarks` skips undefined and highlights related fields; `fieldViews` gives `"n/a"` without confidence
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.14, 4.6, 4.8, 5.1, 5.2, 5.6_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): unit tests for selectors"`
  - [ ] 3.9 Implement `src/model/gauge.ts` and `src/model/confidence.ts`
    - `SWEEP`, `needleAngle`, `knobAngle`, `stepVersion` in `gauge.ts`; `gaugeValue`, `buildGaugeModel` in `confidence.ts` (min of fractured-evidence confidences, else average, else `null`; text `"n/a"` or two decimals)
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.8, 7.9, 7.10, 7.11_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add gauge and knob models"`
  - [ ]* 3.10 Write unit tests for `gauge.ts` and `confidence.ts`
    - Needle at 0, 0.5, 1, `null`, NaN; knob angles for 1, 2, 3 versions; `stepVersion` for each key, boundaries, empty list, value not in list; `gaugeValue` min-versus-average-versus-null cases; non-finite confidence ignored
    - _Requirements: 7.3, 7.4, 7.5, 7.8, 7.9, 7.10, 7.11_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): unit tests for gauge and knob models"`
  - [ ] 3.11 Implement `src/model/ecg.ts`
    - `ECG` constants, `ecgPath(spikeXs, flatline)`, `buildEcgModel(trace, bones)` (clamped spike x, beats skipped within 14 units of a spike, flatline for `rejected`, summary text)
    - _Requirements: 3.1, 3.2, 3.3, 3.5_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add ECG model"`
  - [ ]* 3.12 Write unit tests for `ecg.ts`
    - No fractures gives `"0 spikes"` and empty spike path; one fracture gives `"1 spike"`; flatline for rejected; spike x clamping at both edges; beat skipping near a spike
    - _Requirements: 3.1, 3.2, 3.3, 3.5_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): unit tests for ECG model"`
  - [ ] 3.13 Implement `src/model/chat.ts`
    - `TEMPLATES` (closed set), `MAX_EVIDENCE_LINES = 2`, `buildChatMessages(trace, anatomy)` in the order greeting, one message per mapped fractured outcome, summary, result; ids `greeting`, `fracture-j`, `summary`, `result`
    - Use no string literals outside `TEMPLATES`
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.12_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add Dr. Bones message builder"`
  - [ ]* 3.14 Write unit tests for `chat.ts`
    - Message order and count (`3 + fractured`); singular and plural summary; at most two evidence lines; unmapped fractured outcome gives no message; result line uses `formatValue("amountCents", ...)`; signature trace text snapshot
    - _Requirements: 6.3, 6.4, 6.5_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): unit tests for message builder"`

- [ ] 4. Checkpoint - model layer
  - Run `pnpm --filter @bones/xray-ui test` and `pnpm typecheck` from the repo root. Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Hooks
  - [ ] 5.1 Implement `useReducedMotion` and class helpers
    - `src/hooks/useReducedMotion.ts`: `useSyncExternalStore` on `(prefers-reduced-motion: reduce)`, safe when `matchMedia` is missing, prop override wins; export `animClass(reduced, name)`
    - `src/cx.ts`: `cx(...parts)` filtering falsy and empty strings
    - _Requirements: 11.1, 11.2_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add useReducedMotion"`
  - [ ]* 5.2 Write tests for `useReducedMotion`
    - `src/__tests__/hooks/useReducedMotion.test.tsx`: no `matchMedia` gives false; mock true gives true; override beats mock; a `change` event updates the value; `animClass` and `cx` outputs
    - _Requirements: 11.1, 11.2_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): tests for useReducedMotion"`
  - [ ] 5.3 Implement `useTypewriter`
    - `src/hooks/useTypewriter.ts`: reduced motion returns full text on first render without timers; otherwise one character per `speedMs` (default 24), reset on text change, cleanup on unmount
    - _Requirements: 6.6, 11.3_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add useTypewriter"`
  - [ ]* 5.4 Write tests for `useTypewriter`
    - `src/__tests__/hooks/useTypewriter.test.tsx` with `vi.useFakeTimers()`: partial text over time, `done` flag, reset on text change, reduced motion shows all text immediately, no timers left after unmount
    - _Requirements: 6.6, 11.3_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): tests for useTypewriter"`
  - [ ] 5.5 Implement `useHoveredRule`
    - `src/hooks/useHoveredRule.tsx`: `HoveredRuleProvider` and `useHoveredRule` with a no-op default context
    - _Requirements: 4.6, 9.3_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add hovered rule context"`
  - [ ]* 5.6 Write tests for `useHoveredRule`
    - `src/__tests__/hooks/useHoveredRule.test.tsx`: default value is null and setter is a no-op without a provider; provider shares state between two consumers
    - _Requirements: 4.6, 9.3_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): tests for hovered rule context"`

- [ ] 6. Skeleton, Bone and Tooltip
  - [ ] 6.1 Implement `BoneGlyph` and `BoneButton`
    - `src/components/Bone.tsx`: SVG glyph per state (cyan/dim/red, icon `✓`/`–`/`✕`, crack polyline, splinter polygons, static pulse ring with `anim-pulse` only when motion allowed) and the HTML button with `aria-label` "label, rule id version v, state", visible cue and state text, `data-rule-id`, `data-state`
    - _Requirements: 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 11.4, 11.6, 12.3_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add bone glyph and button"`
  - [ ] 6.2 Implement `Tooltip`
    - `src/components/Tooltip.tsx`: `role="tooltip"` with id from `slug(ruleId)`, head `ruleId vVersion`, state text, `renderedMessage`, and a `dl` with one `dt`/`dd` pair per `evidenceRows` entry; flipped side when `position.x > 280`; state text only for not-applicable bones
    - _Requirements: 2.13, 2.14, 2.16_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add bone tooltip"`
  - [ ] 6.3 Implement `Skeleton`
    - `src/components/Skeleton.tsx`: group with decorative SVG (8 region silhouettes `xr-region`, dotted leader lines, label chips, glyphs), absolutely positioned bone buttons in Anatomy order, local tooltip state, Escape dismissal until pointer or focus leaves and returns, `setHoveredRuleId` calls from pointer enter/leave and focus/blur, React keys `ruleId:index`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.12, 2.13, 2.15, 4.6, 9.3, 12.1_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add Skeleton"`
  - [ ]* 6.4 Write component tests for Skeleton and Tooltip
    - `src/__tests__/components/Skeleton.test.tsx` and `Tooltip.test.tsx`: 8 region silhouettes; one button per Anatomy entry; aria-label format; state cues; hover and focus show the tooltip with id, version, state, message and one `dt`/`dd` per evidence key; `aria-describedby`; Escape closes; leader lines; default formatter when `formatValue` is absent; unmapped outcome draws no bone
    - _Requirements: 2.1, 2.2, 2.4, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): component tests for Skeleton and Tooltip"`

- [ ] 7. EcgLine
  - [ ] 7.1 Implement `EcgLine`
    - `src/components/EcgLine.tsx`: `aria-hidden` SVG with line and spike paths from `buildEcgModel`, visually-hidden summary text, `FLATLINE ✕` label and `xr-ecg-line--flat` class for rejected; `anim-ecg-scroll` and `anim-ecg-flash` only when motion allowed and not flatline
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add EcgLine"`
  - [ ]* 7.2 Write component tests for EcgLine
    - `src/__tests__/components/EcgLine.test.tsx`: `aria-hidden="true"` on the SVG; hidden summary text; non-empty spike path with fractures; flatline label for rejected; no `anim-` class with `reducedMotion`
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): component tests for EcgLine"`

- [ ] 8. FilmClip
  - [ ] 8.1 Implement `FilmClip`
    - `src/components/FilmClip.tsx`: figure with two clip elements; text source as `pre` with `xr-film-line` spans (`data-line`); image source with `img` (`src`, `alt`) and percent-positioned `bbox` marks; `line` band at `lineIndex`; tag labels; highlighted marks use thicker solid outline and `data-highlighted="true"`; active bone from `activeRuleId ?? hoveredRuleId`; skip mismatched or out-of-range marks and undefined sources
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add FilmClip"`
  - [ ]* 8.2 Write component tests for FilmClip
    - `src/__tests__/components/FilmClip.test.tsx`: two clips; text lines; image `src`/`alt`; bbox percentages; line band at index; highlight exactly the related marks via `activeRuleId` and via `HoveredRuleProvider`; undefined source draws no box; bbox on text and line on image are skipped; tag labels present
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): component tests for FilmClip"`

- [ ] 9. AnswerCard
  - [ ] 9.1 Implement `AnswerCard`
    - `src/components/AnswerCard.tsx`: article with one `xr-field` per `FieldView` (label, value, `confidence {text}`, `⚠ OVERRULED` badge); when any field is overruled add the crack overlay SVG (`crackPath(decisionId, 400, 300)`), the `OVERRULED BY RULE` stamp with distinct bone labels, and `anim-shake` / `anim-stamp` only when motion allowed
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 11.4_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add AnswerCard"`
  - [ ]* 9.2 Write component tests for AnswerCard
    - `src/__tests__/components/AnswerCard.test.tsx`: label, value, confidence and `n/a`; badge on overruled fields only; overlay and stamp only with an overruled field; stamp contains the bone label; no `anim-` class with `reducedMotion`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): component tests for AnswerCard"`

- [ ] 10. DrBonesChat
  - [ ] 10.1 Implement `DrBonesChat`
    - `src/components/DrBonesChat.tsx`: panel with avatar and "Dr. Bones · Radiologist"; `role="log"` with `aria-live="polite"`; inner component keyed by `messagesKey`; typing-dots phase (`DOTS_MS = 600`) then `useTypewriter`; reduced motion shows all bubbles at once and calls `onMessagesComplete` once; bubbles use `white-space: pre-line`; optional "Replay decision" and "Human override" buttons, no footer when neither callback is given; no I/O imports
    - _Requirements: 6.1, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 11.3_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add DrBonesChat"`
  - [ ]* 10.2 Write component tests for DrBonesChat
    - `src/__tests__/components/DrBonesChat.test.tsx` with fake timers: title text; log role and `aria-live`; dots then characters; no text node for a message during its dots phase; completion callback fires once; buttons conditional and calling their callbacks; no footer without callbacks; reduced motion shows full text immediately
    - _Requirements: 6.1, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 11.3_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): component tests for DrBonesChat"`

- [ ] 11. Control strip
  - [ ] 11.1 Implement `KnobControl`
    - `src/components/KnobControl.tsx`: `role="slider"` with accessible name, `aria-valuemin/max/now/text`, `onKeyDown` via `stepVersion` (preventDefault only when handled), SVG dial with one tick and label per version, pointer rotated by `knobAngle`, tick hit-target buttons with `tabIndex={-1}` calling `onVersionChange`, `anim-knob` only when motion allowed; no evaluation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 14.5_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add KnobControl"`
  - [ ]* 11.2 Write component tests for KnobControl
    - `src/__tests__/components/KnobControl.test.tsx` with `user-event`: role and name; ArrowRight/Up, ArrowLeft/Down, Home, End; boundaries make no call; empty list; value not in list; pointer rotation per detent; tick click calls the callback
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): component tests for KnobControl"`
  - [ ] 11.3 Implement `GaugeControl`
    - `src/components/GaugeControl.tsx`: `role="meter"` with `aria-valuemin/max`, `aria-valuenow` (omitted when null), `aria-valuetext`; arc dial, needle rotated by `needleAngle`, label "AI READ CONFIDENCE", visible numeric text; `anim-needle` only when motion allowed
    - _Requirements: 7.8, 7.9, 7.10, 7.11_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add GaugeControl"`
  - [ ]* 11.4 Write component tests for GaugeControl
    - `src/__tests__/components/GaugeControl.test.tsx`: meter attributes; `n/a` with empty confidence and no `aria-valuenow`; min-of-fractured value printed; average fallback
    - _Requirements: 7.8, 7.9, 7.10, 7.11_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): component tests for GaugeControl"`
  - [ ] 11.5 Implement `ToggleSwitch`
    - `src/components/ToggleSwitch.tsx`: `<button role="switch" aria-checked>` with lamp `data-lit`, "X-RAY" text and "ON"/"OFF" text; click calls `onXrayChange(!xray)`
    - _Requirements: 7.12, 7.13, 7.14_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add ToggleSwitch"`
  - [ ]* 11.6 Write component tests for ToggleSwitch
    - `src/__tests__/components/ToggleSwitch.test.tsx`: role and `aria-checked`; click, Space and Enter call `onXrayChange(!xray)`; lamp `data-lit`; state text
    - _Requirements: 7.12, 7.13, 7.14_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): component tests for ToggleSwitch"`
  - [ ] 11.7 Implement `ControlStrip`
    - `src/components/ControlStrip.tsx`: `role="group"` "Controls" composing `KnobControl` ("RULE VERSION"), `GaugeControl` and `ToggleSwitch`; forwards `reducedMotion`
    - _Requirements: 7.1, 7.8, 7.12_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add ControlStrip"`
  - [ ]* 11.8 Write component tests for ControlStrip
    - `src/__tests__/components/ControlStrip.test.tsx`: three controls present; version key press and toggle click reach their callbacks; Trace object is not mutated
    - _Requirements: 7.1, 7.7, 7.12, 7.13_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): component tests for ControlStrip"`

- [ ] 12. ResultPlate
  - [ ] 12.1 Implement `ResultPlate`
    - `src/components/ResultPlate.tsx`: `role="status"` with `data-result`, `aria-hidden` icon (`✓`, `◐`, `✕`), `resultLabel` text and the amount via `safeFormat(anatomy)("amountCents", ...)`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add ResultPlate"`
  - [ ]* 12.2 Write component tests for ResultPlate
    - `src/__tests__/components/ResultPlate.test.tsx`: label, icon and amount for each of the three results; default formatter without `formatValue`; custom formatter output
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): component tests for ResultPlate"`

- [ ] 13. Lightbox finish and full styling
  - [ ] 13.1 Complete the Lightbox component
    - Make `xray` a required prop; render the header pill `<span class="xr-pill" data-on>` with "X-RAY ON" or "X-RAY OFF"; set `aria-label={title ?? "X-ray viewer"}`; no images
    - Update `Lightbox.smoke.test.tsx` for the new prop
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add Lightbox X-ray pill"`
  - [ ] 13.2 Write `src/styles/xray.css`
    - Brushed-metal frame (repeating and linear gradients), radial viewport with cyan inset glow, title plate, pill, `xr-glow-cyan` and `xr-glow-red` drop-shadows, bone states, fracture visuals, tooltip, chips, film and clips, answer card, crack overlay, stamp (`rotate(-12deg)`), chat bubbles, typing dots, knob, gauge, toggle lamp, result plate, `.xr-visually-hidden`, `:where(button, [tabindex]):focus-visible` ring, `.xr--plain` paper mode, XrayView grid layout
    - All keyframes live under `anim-*` classes from the animation inventory; add the `@media (prefers-reduced-motion: reduce)` safety rule; use only token variables for colours; no images, no `url(`
    - _Requirements: 1.1, 1.5, 11.4, 12.2, 15.1, 15.2_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add X-ray stylesheet"`
  - [ ]* 13.3 Write component tests for Lightbox
    - Replace the smoke file by `src/__tests__/components/Lightbox.test.tsx`: title plate only with `title`; pill text for true and false; children rendered; no `img` element; `xray.css` contains no `url(`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): component tests for Lightbox"`

- [ ] 14. XrayView composition
  - [ ] 14.1 Implement `XrayView`
    - `src/components/XrayView.tsx`: `HoveredRuleProvider` and `Lightbox`; reference grid (film and answer card, skeleton and ECG, chat, control strip bottom left, result plate); uncontrolled `xray` state defaulting to true when props are absent; when `xray` is false render no Skeleton or EcgLine, show "Skeleton hidden" placeholder and give FilmClip and AnswerCard `xr--plain`; forward `reducedMotion`, `onReplay`, `onOverride`, `onMessagesComplete`, `onVersionChange`
    - _Requirements: 7.15, 7.16, 9.1, 9.3, 14.4, 14.5_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add XrayView composition"`
  - [ ]* 14.2 Write component tests for XrayView
    - `src/__tests__/components/XrayView.test.tsx`: all parts present; `xray` false hides Skeleton and EcgLine but keeps FilmClip and AnswerCard; toggling works uncontrolled and controlled; hovering a bone highlights film marks; knob key press calls `onVersionChange` and the Trace prop is unchanged
    - _Requirements: 7.15, 7.16, 9.1, 9.3, 14.5_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): component tests for XrayView"`

- [ ] 15. Checkpoint - components
  - Run `pnpm --filter @bones/xray-ui test` and `pnpm typecheck` from the repo root. Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Property tests (each in its own file under `src/__tests__/properties/`, `numRuns >= 100`, tag comment `// Feature: xray-ui, Property N: <title>`)
  - If a property test fails, fix the implementation, not the property. Keep a short list of bugs found by property tests in `.kiro/specs/xray-ui/bugs-found.md`.
  - [ ] 16.1 Write property test for fractured bone count
    - `fracture-count.test.tsx`
    - **Property 1: Fractured bone count equals mapped fractured outcomes**
    - **Validates: Requirements 2.7, 18.2**
    - Commit: `git add packages/xray-ui .kiro/specs/xray-ui && git commit -m "test(xray-ui): property 1 fracture count"`
  - [ ] 16.2 Write property test for render determinism
    - `render-determinism.test.tsx`
    - **Property 2: Render determinism**
    - **Validates: Requirements 10.1, 10.4, 18.3**
    - Commit: `git add packages/xray-ui .kiro/specs/xray-ui && git commit -m "test(xray-ui): property 2 render determinism"`
  - [ ] 16.3 Write property test for chat text source
    - `chat-source.test.tsx` (reduced motion, DOM order equals `buildChatMessages` texts; each text equals a `TEMPLATES` output; builder is deterministic; network spy records zero calls)
    - **Property 3: Chat text comes only from the builder and fixed templates**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.12, 14.1, 18.4, 18.5**
    - Commit: `git add packages/xray-ui .kiro/specs/xray-ui && git commit -m "test(xray-ui): property 3 chat text source"`
  - [ ] 16.4 Write property test for reduced motion
    - `reduced-motion.test.tsx` (no `/(^|\s)anim-/` class anywhere, no typing dots, full text, `onMessagesComplete` called, each bone has icon and text cue)
    - **Property 4: Reduced motion removes all animation and shows full text**
    - **Validates: Requirements 11.3, 11.4, 11.5, 11.6, 6.7, 18.6**
    - Commit: `git add packages/xray-ui .kiro/specs/xray-ui && git commit -m "test(xray-ui): property 4 reduced motion"`
  - [ ] 16.5 Write property test for reorder invariance
    - `reorder-invariance.test.ts`
    - **Property 5: Bone states are invariant under reordering of outcomes**
    - **Validates: Requirements 2.5, 2.6, 2.7, 10.4**
    - Commit: `git add packages/xray-ui .kiro/specs/xray-ui && git commit -m "test(xray-ui): property 5 reorder invariance"`
  - [ ] 16.6 Write property test for needle angle
    - `needle-angle.test.ts`
    - **Property 6: Needle angle is monotone and bounded**
    - **Validates: Requirements 7.10, 7.11**
    - Commit: `git add packages/xray-ui .kiro/specs/xray-ui && git commit -m "test(xray-ui): property 6 needle angle"`
  - [ ] 16.7 Write property test for hash visuals
    - `hash.test.ts`
    - **Property 7: Hash-derived visuals are deterministic and bounded**
    - **Validates: Requirements 2.8, 5.3, 10.2**
    - Commit: `git add packages/xray-ui .kiro/specs/xray-ui && git commit -m "test(xray-ui): property 7 hash visuals"`
  - [ ] 16.8 Write property test for gauge value
    - `gauge-value.test.ts`
    - **Property 8: Gauge value is a valid confidence or null**
    - **Validates: Requirements 7.8, 7.9, 7.10**
    - Commit: `git add packages/xray-ui .kiro/specs/xray-ui && git commit -m "test(xray-ui): property 8 gauge value"`
  - [ ] 16.9 Write property test for bone partition
    - `bone-partition.test.ts`
    - **Property 9: One bone per anatomy entry, partitioned into three states**
    - **Validates: Requirements 2.2, 2.4, 2.5, 2.6**
    - Commit: `git add packages/xray-ui .kiro/specs/xray-ui && git commit -m "test(xray-ui): property 9 bone partition"`
  - [ ] 16.10 Write property test for layout
    - `layout.test.ts`
    - **Property 10: Layout depends only on region order and stays inside the region**
    - **Validates: Requirements 2.3**
    - Commit: `git add packages/xray-ui .kiro/specs/xray-ui && git commit -m "test(xray-ui): property 10 layout"`
  - [ ] 16.11 Write property test for the ECG model
    - `ecg-model.test.ts`
    - **Property 11: ECG model matches fractures and rejection**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
    - Commit: `git add packages/xray-ui .kiro/specs/xray-ui && git commit -m "test(xray-ui): property 11 ECG model"`
  - [ ] 16.12 Write property test for knob stepping
    - `step-version.test.ts`
    - **Property 12: Knob stepping never leaves the version list**
    - **Validates: Requirements 7.3, 7.4, 7.5**
    - Commit: `git add packages/xray-ui .kiro/specs/xray-ui && git commit -m "test(xray-ui): property 12 knob stepping"`
  - [ ] 16.13 Write property test for overruled fields
    - `overruled-fields.test.tsx` (selector sets, `fieldViews` flags, `n/a` confidence, AnswerCard overlay and stamp iff non-empty)
    - **Property 13: Overruled fields are exactly the evidence keys of fractured bones**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**
    - Commit: `git add packages/xray-ui .kiro/specs/xray-ui && git commit -m "test(xray-ui): property 13 overruled fields"`
  - [ ] 16.14 Write property test for the default formatter
    - `default-format.test.ts` (use `fc.anything()` plus cyclic and symbol values; throwing `formatValue`)
    - **Property 14: Default formatter is total**
    - **Validates: Requirements 2.16, 8.5**
    - Commit: `git add packages/xray-ui .kiro/specs/xray-ui && git commit -m "test(xray-ui): property 14 default formatter"`

- [ ] 17. Guard tests
  - [ ] 17.1 Write the domain-isolation test
    - `src/__tests__/domain-isolation.test.ts`: walk `packages/xray-ui/src` with `node:fs`, skip `__tests__` directories, scan `.ts`, `.tsx`, `.css` files for `/\b(receipt|expense|alcohol|meal|trip|suspect)\b/i`; the word "case" is not checked; `demo/` is not scanned
    - Fix any offending source file found
    - _Requirements: 13.1, 13.2, 13.3, 18.7_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): domain isolation"`
  - [ ] 17.2 Write the contrast test
    - `src/__tests__/helpers/contrast.ts` (`relativeLuminance`, `contrastRatio`) and `src/__tests__/contrast.test.ts` with the typed `TOKEN_PAIRS` (15 pairs from design.md); read hex values from `tokens.css` by regex; require every ratio >= 4.5 and every token name to exist in the CSS
    - Adjust token values (not the threshold) if a pair fails
    - _Requirements: 12.4, 18.8_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): token contrast"`
  - [ ] 17.3 Write the source-hygiene test
    - `src/__tests__/source-hygiene.test.ts`: scan `src` (excluding `__tests__`) for `Math.random`, `Date.now`, `new Date(`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `<canvas`, `getContext(`, `new Audio`, `AudioContext`, `api[_-]?key` (case-insensitive), and imports of `openai` or `anthropic`; expect none; also assert `package.json` has `react` and `react-dom` as peerDependencies and exact versions (no `^` or `~`) for devDependencies
    - _Requirements: 10.3, 14.2, 14.3, 15.2, 15.4, 15.5_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): source hygiene"`
  - [ ] 17.4 Write the no-network test
    - `src/__tests__/no-network.test.tsx`: install `netSpy`, render `DrBonesChat` and `XrayView` with fake timers, advance to completion, assert zero recorded calls and `onMessagesComplete` called; restore in `afterEach`
    - _Requirements: 6.12, 14.1, 18.5_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): no network calls"`
  - [ ] 17.5 Write the accessibility role test
    - `src/__tests__/a11y-roles.test.tsx`: render `XrayView` with the signature trace; assert roles `slider` (named), `meter`, `switch` with `aria-checked`, `log` with `aria-live="polite"`, `tooltip` on hover, `status` for the result plate, `aria-hidden="true"` on ECG svg; every bone button has an accessible name; every bone state has visible text; Tab order visits bones in Anatomy order
    - _Requirements: 2.9, 2.10, 2.11, 3.4, 6.8, 7.6, 7.12, 12.1, 12.3_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): accessibility roles"`

- [ ] 18. Demo
  - [ ] 18.1 Create `demo/anatomy.ts`
    - Export `demoAnatomy` with the five bones, field labels and the `*Cents` formatter (`EUR 41.50`) from design.md
    - _Requirements: 16.3_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add demo anatomy"`
  - [ ] 18.2 Create `demo/demoTrace.ts`
    - Export `VERSIONS`, `DemoVersion`, `buildCatalog()` (seven rule files, keys `id@version`) and `buildTrace(version)`: validate the signature scenario fields with zod, pick the rule set JSON, use `amountScopes = [{ name: "total", claimedCents: lineItemSumCents }]`, call `evaluate` and `createTrace` from `@bones/core` with deterministic stub ports; throw on a `CoreError`
    - Import the JSON files from `../../core/test-fixtures/expense/...`; confirm the needed functions are exported from `packages/core/src/index.ts`
    - _Requirements: 16.2, 16.5, 16.6_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add demo trace builder"`
  - [ ] 18.3 Create the demo page and `dev` script
    - `demo/index.html`, `demo/main.tsx` (import `XrayView` from `../src/components/XrayView` and both CSS files directly; `useState<DemoVersion>("v1")`, `useMemo` trace, film text lines supplied by the demo, replay handler bumping a key, no override handler)
    - Confirm `dev` = `vite --config demo/vite.config.ts` in `package.json` and that `pnpm typecheck` passes
    - _Requirements: 16.1, 16.4, 16.5_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add demo page"`
  - [ ] 18.4 Write the demo smoke test
    - `src/__tests__/demo-smoke.test.tsx`: `buildTrace("v1")`, `"v2"`, `"v3"` all give `partially_approved` and `amountCents` 4150; render `XrayView` with `demoAnatomy` without console errors; knob key press changes shown rule-set version from `1.0.0` to `2.0.0`; add `server.deps.inline: ["@bones/core"]` to `vitest.config.ts` only if needed
    - _Requirements: 16.2, 16.4, 16.5, 16.6, 18.9_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): demo smoke test"`

- [ ] 19. Public barrel
  - [ ] 19.1 Write the final `src/index.ts`
    - Export all components, hooks, model functions, `TEMPLATES`, constants and types listed in design.md; import `./styles/tokens.css` and `./styles/xray.css`; export no audio symbol
    - _Requirements: 9.2, 14.3, 15.3_
    - Commit: `git add packages/xray-ui && git commit -m "feat(xray-ui): add public exports"`
  - [ ]* 19.2 Write a barrel export test
    - `src/__tests__/exports.test.ts`: every component name exports a function; hooks and model functions are present; no export name matches `/audio|sound/i`
    - _Requirements: 9.2, 14.3_
    - Commit: `git add packages/xray-ui && git commit -m "test(xray-ui): barrel exports"`

- [ ] 20. Documentation
  - [ ] 20.1 Write `packages/xray-ui/README.md`
    - Sections: installation in the pnpm workspace; the Anatomy contract with an example; the list of exported components; reduced-motion behaviour; accessibility notes including the statement that automated tests cover token contrast ratios and ARIA roles only and full WCAG validation needs manual testing with assistive technologies; the "no LLM, no network, no rule evaluation" guarantee; how to run the demo (`pnpm --filter @bones/xray-ui dev`)
    - _Requirements: 12.5, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_
    - Commit: `git add packages/xray-ui && git commit -m "docs(xray-ui): add README"`

- [ ] 21. Final checkpoint
  - Run `pnpm test` and `pnpm typecheck` from the repo root; both must pass for all packages
  - Run `git status` and confirm a clean working tree (everything committed, `.kiro/` tracked)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional unit or component tests; property tests, domain isolation, contrast, source hygiene, no-network, a11y role and demo smoke tests are required.
- Every property test is its own file and `it(...)`, uses `numRuns >= 100` and carries the tag comment `// Feature: xray-ui, Property N: <title>`.
- If a property test fails, fix the implementation, not the property, and log it in `.kiro/specs/xray-ui/bugs-found.md`.
- The demo lives outside `src/`, so it may use expense wording and runtime imports from `@bones/core`; `src/` imports `@bones/core` types only.
- Waves are ordered so that tasks in one wave touch different files.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["3.1", "3.3"] },
    { "id": 5, "tasks": ["3.2", "3.4", "3.5"] },
    { "id": 6, "tasks": ["3.6", "3.7"] },
    { "id": 7, "tasks": ["3.8", "3.9", "3.11"] },
    { "id": 8, "tasks": ["3.10", "3.12", "3.13"] },
    { "id": 9, "tasks": ["3.14"] },
    { "id": 10, "tasks": ["5.1", "5.3", "5.5"] },
    { "id": 11, "tasks": ["5.2", "5.4", "5.6"] },
    { "id": 12, "tasks": ["6.1", "6.2"] },
    { "id": 13, "tasks": ["6.3", "7.1", "8.1"] },
    { "id": 14, "tasks": ["6.4", "7.2", "8.2", "9.1"] },
    { "id": 15, "tasks": ["9.2", "10.1", "11.1"] },
    { "id": 16, "tasks": ["10.2", "11.2", "11.3"] },
    { "id": 17, "tasks": ["11.4", "11.5", "12.1"] },
    { "id": 18, "tasks": ["11.6", "11.7", "12.2"] },
    { "id": 19, "tasks": ["11.8", "13.1"] },
    { "id": 20, "tasks": ["13.2", "14.1"] },
    { "id": 21, "tasks": ["13.3", "14.2"] },
    { "id": 22, "tasks": ["16.1", "16.2", "16.3"] },
    { "id": 23, "tasks": ["16.4", "16.5", "16.6"] },
    { "id": 24, "tasks": ["16.7", "16.8", "16.9"] },
    { "id": 25, "tasks": ["16.10", "16.11", "16.12"] },
    { "id": 26, "tasks": ["16.13", "16.14", "17.1"] },
    { "id": 27, "tasks": ["17.2", "17.3", "17.4"] },
    { "id": 28, "tasks": ["17.5", "18.1", "18.2"] },
    { "id": 29, "tasks": ["18.3"] },
    { "id": 30, "tasks": ["18.4"] },
    { "id": 31, "tasks": ["19.1"] },
    { "id": 32, "tasks": ["19.2", "20.1"] }
  ]
}
```
