# Requirements Document

## Introduction

`packages/xray-ui` is a new React + Vite library (TypeScript strict, pnpm workspace) that renders any `Trace` produced by `@bones/core` as a 1950s-radiology X-ray. A decision is drawn as a glowing skeleton: each mapped rule is one bone, a rule that changed the decision is a fractured bone, and an ECG line, a film clip, an answer card, a chat panel, a control strip and a result plate complete the view. The library knows nothing about what a rule means. The host app supplies an `Anatomy` (rule-to-bone mapping, field labels, optional value formatter) and a `Trace`.

Key properties of the library:

- Rendering is deterministic: same Trace + same Anatomy + same props yield identical DOM.
- No domain words appear in `src/`.
- No rule evaluation, no replay, no LLM, no network calls.
- Colour is never the only signal; motion respects `prefers-reduced-motion`.

Reference look (reference only, never imported): `design/mockups/bones-7-retro-b.png`, `bones-3-hover-doctor-a.png`, `bones-4-fracture-a.png`.

Input contract:

```ts
type Region = "skull"|"spine"|"ribs"|"arm-left"|"arm-right"|"pelvis"|"leg-left"|"leg-right";
interface Anatomy {
  bones: { ruleId: string; label: string; region: Region }[];
  fieldLabels: Record<string, string>;
  formatValue?: (path: string, value: unknown) => string;
}
```

### Out of scope

- Rule evaluation or replay inside xray-ui (the app replays and passes a new Trace).
- Any LLM or network call.
- Sound (no audio shipped, none exposed).
- A canvas layer (SVG and CSS only).
- Storybook.
- The case-files and expense-auditor apps.
- Raster mockup assets (mockups are reference only).

## Glossary

- **Xray_UI**: The `@bones/xray-ui` package in `packages/xray-ui`.
- **Core**: The `@bones/core` package that produces `Trace` objects.
- **Trace**: The immutable decision record defined in `packages/core/src/types.ts`.
- **RuleOutcome**: One entry of `Trace.ruleOutcomes` (ruleId, ruleVersion, effect, conditionMet, evidence, renderedMessage, optional deductedCents, appliedCapCents, amountBeforeCents and amountAfterCents). The optional `amountBeforeCents` and `amountAfterCents` are the running amount in the rule scope before and after the rule (see Requirement 19).
- **Anatomy**: The app-supplied object holding `bones`, `fieldLabels` and optional `formatValue`.
- **Mapped_Rule**: A rule whose `ruleId` has an entry in `Anatomy.bones`.
- **Bone**: The visual element representing one Mapped_Rule on a Region of the Skeleton.
- **Region**: One of `skull`, `spine`, `ribs`, `arm-left`, `arm-right`, `pelvis`, `leg-left`, `leg-right`.
- **Bone_State**: One of `passed`, `not-applicable`, `fractured`.
- **Passed_Bone**: A Bone whose outcome exists and is not a Fractured_Outcome. This covers an outcome with `conditionMet` false and an Applied_No_Change_Outcome.
- **Not_Applicable_Bone**: A Bone whose `ruleId` has no outcome in the Trace.
- **Fractured_Bone**: A Bone whose outcome is a Fractured_Outcome.
- **Fractured_Outcome**: A RuleOutcome of a Mapped_Rule with `conditionMet` true and either `effect` equal to blocking, or `effect` in {capping, deducting} with both `amountBeforeCents` and `amountAfterCents` present and `amountAfterCents` less than `amountBeforeCents`. A rule fractures a Bone only when it changed the decision. A capping or deducting outcome that lacks either amount field is not a Fractured_Outcome.
- **Applied_No_Change_Outcome**: A RuleOutcome of a Mapped_Rule with `conditionMet` true and `effect` in {capping, deducting} that is not a Fractured_Outcome, meaning the rule applied but did not lower the amount. Its Bone is shown as passed with the state text "applied, no change".
- **Evidence_Key**: A key of `RuleOutcome.evidence`, which is a field path and may be a computed key such as `items[*].amount_sum`.
- **Related_Field**: A field whose path equals (exact match) an Evidence_Key of a Bone's outcome.
- **Overruled_Field**: A field whose path is an Evidence_Key of at least one Fractured_Outcome.
- **Default_Formatter**: The deterministic formatter used when `Anatomy.formatValue` is absent (strings as is, numbers via `String`, all other values via `JSON.stringify`).
- **Lightbox**: The dark radiology viewer component with brushed-metal frame and title plate.
- **Skeleton**: The inline SVG anatomical skeleton component with the 8 Regions.
- **EcgLine**: The heartbeat SVG line component.
- **FilmClip**: The component showing the source input as an X-ray film held by two clips.
- **FilmSource**: The app-supplied source, `{ kind: "text"; text: string } | { kind: "image"; src: string; alt: string }`.
- **AnswerCard**: The component showing the AI's proposed fields with per-field confidence.
- **DrBonesChat**: The phone-style chat panel for "Dr. Bones · Radiologist".
- **Message_Builder**: The pure function module inside Xray_UI that builds the ordered chat messages from a Trace, an Anatomy and a closed set of fixed templates.
- **ControlStrip**: The component holding the RULE VERSION knob, the AI READ CONFIDENCE gauge and the X-RAY toggle.
- **Version_Knob**: The RULE VERSION rotary knob.
- **Confidence_Gauge**: The AI READ CONFIDENCE needle gauge.
- **Xray_Toggle**: The X-RAY switch with lamp.
- **ResultPlate**: The component showing the decision result label, icon and amount.
- **XrayView**: The optional composition of all components in the reference layout.
- **Demo_App**: The Vite demo under `packages/xray-ui/demo`, which is outside `src/`.
- **Signature_Fixture**: `packages/core/test-fixtures/expense/recorded/signature-scenario.json`.
- **Reduced_Motion_Mode**: The state in which the `prefers-reduced-motion: reduce` media query matches or the `reducedMotion` prop is true.
- **Animated_Class**: A CSS class name starting with `anim-`.
- **Design_Tokens**: The CSS variables defining colours, spacing and glow in the Xray_UI stylesheet.
- **Domain_Words**: The forbidden terms `receipt`, `expense`, `alcohol`, `meal`, `trip`, `suspect`.

## Requirements

### Requirement 1: Lightbox

**User Story:** As a developer, I want a radiology-style viewer frame, so that every decision is shown in the same recognisable X-ray setting.

#### Acceptance Criteria

1. THE Lightbox SHALL render a dark viewing area with a cyan glow inside a brushed-metal frame built with CSS only.
2. WHEN a `title` prop is provided, THE Lightbox SHALL render the title on a title plate.
3. THE Lightbox SHALL render its children inside the viewing area.
4. THE Lightbox SHALL render a header pill with the text "X-RAY ON" while the `xray` prop is true and "X-RAY OFF" while the `xray` prop is false.
5. THE Lightbox SHALL render without any raster image asset.

### Requirement 2: Skeleton and Bones

**User Story:** As an auditor, I want each rule drawn as a bone on an anatomical skeleton, so that I can see at a glance which rules passed and which fractured.

#### Acceptance Criteria

1. THE Skeleton SHALL render an inline SVG skeleton containing the 8 Regions.
2. THE Skeleton SHALL render exactly one Bone for each entry of `Anatomy.bones`, placed on the Region named in that entry.
3. WHEN several Anatomy entries share a Region, THE Skeleton SHALL place their Bones inside that Region in the order of `Anatomy.bones`, using a layout that depends only on that order.
4. THE Skeleton SHALL render no Bone for a rule that is in the Trace but has no entry in `Anatomy.bones`.
5. WHEN a Mapped_Rule has an outcome that is not a Fractured_Outcome, THE Skeleton SHALL render its Bone in the `passed` state with a cyan glow.
6. WHEN an Anatomy entry has no outcome with the same `ruleId` in the Trace, THE Skeleton SHALL render its Bone in the `not-applicable` state with a dimmed style.
7. WHEN a Mapped_Rule has a Fractured_Outcome, THE Skeleton SHALL render its Bone in the `fractured` state with a red glow, a crack line, splinters and a pulse ring.
8. THE Skeleton SHALL derive splinter positions and angles only from a pure hash function of the `ruleId`.
9. THE Skeleton SHALL render each Bone as a focusable `<button>` or element with `role="button"`.
10. THE Skeleton SHALL give each Bone an `aria-label` containing the Anatomy label, the rule version and the Bone_State in words.
11. THE Skeleton SHALL render each Bone state with a text or icon cue in addition to colour.
12. THE Skeleton SHALL render a dotted leader line from each Bone to its label chip.
13. WHEN a Bone is hovered or receives keyboard focus, THE Skeleton SHALL show a tooltip containing the rule id, the rule version, the state text and the `renderedMessage`.
14. WHEN the tooltip is shown, THE Skeleton SHALL list one evidence row per Evidence_Key, with the label `fieldLabels[path] ?? path` and the value `formatValue(path, value)`.
15. WHEN the Escape key is pressed while the tooltip is shown, THE Skeleton SHALL close the tooltip.
16. WHERE `Anatomy.formatValue` is absent, THE Skeleton SHALL format evidence values with the Default_Formatter.
17. THE Skeleton SHALL use the state text "fractured" for a Fractured_Bone, "applied, no change" for a Bone whose outcome is an Applied_No_Change_Outcome, "passed" for any other Passed_Bone, and "not applicable" for a Not_Applicable_Bone, in the `aria-label`, in the tooltip and in the visible cue.
18. THE Skeleton SHALL decide the Bone_State only from `conditionMet`, `effect`, `amountBeforeCents` and `amountAfterCents` of the outcome.

### Requirement 3: ECG Line

**User Story:** As an auditor, I want a heartbeat line that spikes at each fracture, so that problems are visible across the whole skeleton.

#### Acceptance Criteria

1. WHILE the Trace result is not `rejected`, THE EcgLine SHALL render a heartbeat line with normal beats across the Skeleton.
2. WHEN a Fractured_Bone exists, THE EcgLine SHALL render one red spike for it, with the x position aligned to that Bone.
3. WHEN the Trace result is `rejected`, THE EcgLine SHALL render a red-tinted flat line without beats and with a visible "flatline" text or icon.
4. THE EcgLine SHALL set `aria-hidden="true"` on the graphic.
5. THE EcgLine SHALL include a visually-hidden text summary stating the number of spikes, or stating "flatline" when the result is `rejected`.
6. WHILE Reduced_Motion_Mode is active, THE EcgLine SHALL render the line without scrolling animation.

### Requirement 4: Film Clip

**User Story:** As an auditor, I want to see the source input as film with the read locations marked, so that I can check where the AI found each value.

#### Acceptance Criteria

1. THE FilmClip SHALL render the FilmSource held by two clips.
2. WHEN the FilmSource kind is `text`, THE FilmClip SHALL render the text as a document.
3. WHEN the FilmSource kind is `image`, THE FilmClip SHALL render the image using `src` and `alt`.
4. WHEN a `trace.sources` entry has kind `bbox`, THE FilmClip SHALL draw a rectangle over the image using the normalized x, y, width and height values.
5. WHEN a `trace.sources` entry has kind `line`, THE FilmClip SHALL draw a highlight band over the text line at `lineIndex`.
6. WHEN a Bone is hovered or focused, THE FilmClip SHALL highlight the source boxes of all Related_Fields of that Bone's outcome.
7. THE FilmClip SHALL give each source box an outline style and a text label, so that the box is identifiable without colour.
8. WHEN a `trace.sources` entry is undefined, THE FilmClip SHALL draw no box for that field.

### Requirement 5: Answer Card

**User Story:** As an auditor, I want the AI's proposed fields shown with confidence and marked when a rule overruled them, so that I see where the AI read was not enough.

#### Acceptance Criteria

1. THE AnswerCard SHALL render each entry of `trace.proposedFields` with the label `fieldLabels[path] ?? path`, the value `formatValue(path, value)` and the confidence from `trace.confidence` as text.
2. WHEN a field path is an Evidence_Key of at least one Fractured_Outcome, THE AnswerCard SHALL mark that field as an Overruled_Field with a text badge and an icon.
3. WHEN at least one Overruled_Field exists, THE AnswerCard SHALL render an SVG crack overlay derived deterministically from a hash of `decisionId`.
4. WHEN at least one Overruled_Field exists, THE AnswerCard SHALL render a tilted stamp "OVERRULED BY RULE" together with the Anatomy label of the fractured Bone.
5. WHEN no Overruled_Field exists, THE AnswerCard SHALL render no crack overlay and no stamp.
6. IF a proposed field has no entry in `trace.confidence`, THEN THE AnswerCard SHALL render the confidence text "n/a" for that field.

### Requirement 6: Dr. Bones Chat

**User Story:** As a developer, I want a chat panel that explains a decision from the trace only, so that explanations are auditable and never invented.

#### Acceptance Criteria

1. THE DrBonesChat SHALL render a phone-style panel with an avatar and the title "Dr. Bones · Radiologist".
2. THE Message_Builder SHALL build the message list as a pure function of the Trace, the Anatomy and a closed set of fixed template functions.
3. THE Message_Builder SHALL order messages as: one greeting message, one message per Fractured_Outcome in `Trace.ruleOutcomes` order, one passed-bone count summary message, and one final result message.
4. THE Message_Builder SHALL build each fractured-outcome message from a fixed template, the outcome's `renderedMessage` and at most two evidence rows formatted with `formatValue`.
5. THE Message_Builder SHALL build the final result message from the result label and the amount formatted with `formatValue("amountCents", trace.amountCents)`.
6. THE DrBonesChat SHALL render each message as a typing-dots phase followed by character-by-character text output.
7. WHEN all messages have finished typing, THE DrBonesChat SHALL call the `onMessagesComplete` callback.
8. THE DrBonesChat SHALL render the messages inside a log region with `aria-live="polite"`.
9. WHERE the `onReplay` callback is provided, THE DrBonesChat SHALL render a "Replay decision" button that calls `onReplay` when activated.
10. WHERE the `onOverride` callback is provided, THE DrBonesChat SHALL render a "Human override" button that calls `onOverride` when activated.
11. WHERE neither `onReplay` nor `onOverride` is provided, THE DrBonesChat SHALL render no action button.
12. THE DrBonesChat SHALL call no LLM and no network API during render, typing or completion.

### Requirement 7: Control Strip

**User Story:** As a user, I want a control strip with a rule version knob, a confidence gauge and an X-ray switch, so that I can change the view and see how reliable the AI read was.

#### Acceptance Criteria

1. THE Version_Knob SHALL accept the props `versions: string[]`, `value: string` and `onVersionChange(version)`.
2. THE Version_Knob SHALL render a labelled rotary knob with one discrete detent per entry of `versions`, with the pointer at the detent of `value`.
3. WHEN the ArrowRight or ArrowUp key is pressed on the Version_Knob, THE Version_Knob SHALL call `onVersionChange` with the next version, and WHEN the ArrowLeft or ArrowDown key is pressed, with the previous version.
4. WHEN the Home or End key is pressed on the Version_Knob, THE Version_Knob SHALL call `onVersionChange` with the first or last version respectively.
5. IF a step key would move beyond the first or last version, THEN THE Version_Knob SHALL keep the current value and make no `onVersionChange` call.
6. THE Version_Knob SHALL expose a radiogroup or slider role with an accessible name.
7. THE Version_Knob SHALL perform no rule evaluation and SHALL leave the Trace unchanged.
8. WHEN a Fractured_Outcome has an Evidence_Key that exists in `trace.confidence`, THE Confidence_Gauge SHALL use the lowest confidence among those fields as its value.
9. WHEN no such field exists and `trace.confidence` is not empty, THE Confidence_Gauge SHALL use the average of all `trace.confidence` values as its value.
10. IF `trace.confidence` is empty, THEN THE Confidence_Gauge SHALL show the text "n/a" and park the needle at its rest position.
11. THE Confidence_Gauge SHALL compute the needle angle as a pure function that maps a value in 0..1 to a fixed sweep, and SHALL print the numeric value as text.
12. THE Xray_Toggle SHALL accept the props `xray: boolean` and `onXrayChange`, and SHALL render with `role="switch"` and `aria-checked` equal to `xray`.
13. WHEN the Xray_Toggle is activated by click or by the Space or Enter key, THE Xray_Toggle SHALL call `onXrayChange` with the negated value.
14. THE Xray_Toggle SHALL render a lamp that is lit while `xray` is true and SHALL show the state as text.
15. WHILE `xray` is false, THE XrayView SHALL show the FilmClip and AnswerCard content as an ordinary document and SHALL hide the Skeleton.
16. WHILE `xray` is true, THE XrayView SHALL show the Skeleton view.

### Requirement 8: Result Plate

**User Story:** As an auditor, I want a clear result label with amount, so that the outcome is readable without colour.

#### Acceptance Criteria

1. WHEN the Trace result is `approved`, THE ResultPlate SHALL show the text "APPROVED" and an approval icon.
2. WHEN the Trace result is `partially_approved`, THE ResultPlate SHALL show the text "PARTIALLY APPROVED" and a partial icon.
3. WHEN the Trace result is `rejected`, THE ResultPlate SHALL show the text "REJECTED" and a rejection icon.
4. THE ResultPlate SHALL show the amount produced by `formatValue("amountCents", trace.amountCents)`.
5. WHERE `Anatomy.formatValue` is absent, THE ResultPlate SHALL format the amount with the Default_Formatter.

### Requirement 9: XrayView Composition

**User Story:** As a developer, I want one ready-made composition, so that I can show a full X-ray with a single component while still using each part alone.

#### Acceptance Criteria

1. THE XrayView SHALL compose Lightbox, Skeleton, EcgLine, FilmClip, AnswerCard, DrBonesChat, ControlStrip and ResultPlate in the reference layout.
2. THE Xray_UI SHALL export every component so that each one renders without XrayView.
3. WHEN a Bone is hovered or focused in the XrayView, THE XrayView SHALL pass the active Bone to the FilmClip so that the related source boxes are highlighted.

### Requirement 10: Deterministic Rendering

**User Story:** As an auditor, I want identical output for identical input, so that a replayed decision looks the same every time.

#### Acceptance Criteria

1. FOR ALL Trace, Anatomy and props combinations, rendering the same inputs twice SHALL produce identical HTML.
2. THE Xray_UI SHALL derive every hash-based visual from a pure function of `ruleId` or `decisionId`.
3. THE Xray_UI SHALL use no `Math.random` and no `Date.now` in render code.
4. THE Xray_UI SHALL render every Bone_State count, label and message as a function of the Trace and the Anatomy only.

### Requirement 11: Reduced Motion

**User Story:** As a user who prefers less motion, I want animations removed, so that the view stays usable and comfortable.

#### Acceptance Criteria

1. THE Xray_UI SHALL export a `useReducedMotion` hook that reads the `prefers-reduced-motion: reduce` media query.
2. WHERE a `reducedMotion` prop is provided, THE Xray_UI SHALL use the prop value instead of the media query result.
3. WHILE Reduced_Motion_Mode is active, THE DrBonesChat SHALL render each message with its full text immediately and without a typing phase.
4. WHILE Reduced_Motion_Mode is active, THE Xray_UI SHALL render no pulse-ring animation, no shake and no ECG scrolling.
5. WHILE Reduced_Motion_Mode is active, THE Xray_UI SHALL render a DOM containing no Animated_Class.
6. WHILE Reduced_Motion_Mode is active, THE Xray_UI SHALL still show every Bone_State with colour, icon and text.

### Requirement 12: Accessibility

**User Story:** As a keyboard or screen-reader user, I want every control operable and every state named, so that I can use the X-ray without sight of colour or a mouse.

#### Acceptance Criteria

1. THE Xray_UI SHALL make every interactive control operable with the keyboard.
2. THE Xray_UI SHALL show a visible focus ring on every focusable element.
3. THE Xray_UI SHALL convey every Bone_State, result and overruled marker with text or an icon in addition to colour.
4. THE Xray_UI SHALL use text and background colour pairs from the Design_Tokens whose contrast ratio is at least 4.5:1 for normal text and at least 3:1 for large text.
5. THE Xray_UI SHALL document in the README that automated tests cover token contrast ratios and ARIA roles only, and that full WCAG validation needs manual testing with assistive technologies.

### Requirement 13: Domain Isolation

**User Story:** As a maintainer, I want xray-ui to contain no domain wording, so that the same components serve every app built on Bones.

#### Acceptance Criteria

1. THE Xray_UI SHALL contain none of the Domain_Words as whole words, compared case-insensitively, in any file under `packages/xray-ui/src`, excluding `__tests__` directories.
2. THE Xray_UI SHALL skip the word "case" in the domain-word check, matching the check in `packages/core`.
3. THE Demo_App SHALL be exempt from the domain-word check.
4. THE Xray_UI SHALL treat every rule as opaque and SHALL read only `ruleId`, `ruleVersion`, `effect`, `conditionMet`, `evidence`, `renderedMessage`, `amountBeforeCents`, `amountAfterCents` and the Anatomy entry of each rule.

### Requirement 14: Safety and Boundaries

**User Story:** As a security-minded developer, I want the UI library to be silent and offline, so that it cannot leak data or keys and cannot decide anything.

#### Acceptance Criteria

1. THE Xray_UI SHALL make no network call.
2. THE Xray_UI SHALL contain no API key and no reference to an LLM client.
3. THE Xray_UI SHALL ship no audio asset and expose no sound API.
4. THE Xray_UI SHALL perform no rule evaluation and no replay.
5. WHEN the Version_Knob value changes, THE Xray_UI SHALL delegate the replay to the host app through `onVersionChange`.

### Requirement 15: Styling and Package

**User Story:** As a developer, I want a small, standard package setup, so that I can consume xray-ui in any app in the workspace.

#### Acceptance Criteria

1. THE Xray_UI SHALL style components with plain CSS (CSS modules or one stylesheet with Design_Tokens as CSS variables) and inline SVG.
2. THE Xray_UI SHALL contain no canvas layer.
3. THE Xray_UI SHALL be an ESM package whose `exports` field points to `./src/index.ts`.
4. THE Xray_UI SHALL declare `react` and `react-dom` as `peerDependencies` and `@bones/core` as a `workspace:` dependency.
5. THE Xray_UI SHALL pin exact versions for the devDependencies `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `fast-check`, `typescript`, `@types/react` and `@types/react-dom`.
6. THE Xray_UI SHALL compile under TypeScript strict mode.
7. WHEN `pnpm typecheck` is run in `packages/xray-ui`, THE Xray_UI SHALL complete without type errors.
8. WHEN `pnpm test` is run in `packages/xray-ui`, THE Xray_UI SHALL run all tests and report success.
9. WHEN the root scripts run `pnpm -r typecheck` or `pnpm -r test`, THE Xray_UI SHALL take part in them.

### Requirement 16: Demo

**User Story:** As a developer, I want a runnable demo with the core signature fixture, so that I can see xray-ui working with a real decision.

#### Acceptance Criteria

1. THE Demo_App SHALL live in `packages/xray-ui/demo` as a Vite app without Storybook.
2. THE Demo_App SHALL evaluate the Signature_Fixture through `@bones/core` `evaluate` and `createTrace`, using the rule sets expense-v1, expense-v2 and expense-v3 and the rules in `rules/expense-auditor/rules`.
3. THE Demo_App SHALL define its own Anatomy with expense wording.
4. THE Demo_App SHALL render an XrayView for the resulting Trace.
5. WHEN the Version_Knob reports a new version, THE Demo_App SHALL call `evaluate` and `createTrace` for that rule set version and pass the new Trace to the XrayView.
6. THE Demo_App SHALL use the rule set expense-v1 as its default version, and WHEN it starts at that version, THE Demo_App SHALL produce the result `partially_approved` with `amountCents` equal to 4150.
7. WHEN the Demo_App renders the Signature_Fixture at the default version, THE XrayView SHALL show exactly two Fractured_Bones, the line-item match bone and the alcohol bone, and SHALL show the meal-limit bone as passed with the state text "applied, no change".
8. THE Demo_App Anatomy SHALL map the line-item rule, the alcohol rule and the meal-limit rule to Bones.
9. THE Demo_App SHALL start the amount scope at `claimedTotalCents` of the Signature_Fixture (48000), and at each of the versions expense-v1, expense-v2 and expense-v3 the outcomes SHALL be: line-item rule 48000 → 4800 (fractured), meal-limit rule 4800 → 4800 with cap 5000, 6000 and 7500 respectively (applied, no change), alcohol rule 4800 → 4150 (fractured), result `partially_approved` and `amountCents` 4150.

### Requirement 17: Documentation

**User Story:** As a developer, I want a short README, so that I can adopt xray-ui without reading the source.

#### Acceptance Criteria

1. THE Xray_UI SHALL include a `packages/xray-ui/README.md`.
2. THE README SHALL describe installation in the pnpm workspace.
3. THE README SHALL describe the Anatomy contract.
4. THE README SHALL list the exported components.
5. THE README SHALL describe reduced-motion behaviour and the accessibility notes from Requirement 12.
6. THE README SHALL state the "no LLM" guarantee.

### Requirement 18: Test Suite

**User Story:** As a maintainer, I want component tests and property tests, so that the guarantees above stay true as the library changes.

#### Acceptance Criteria

1. THE Xray_UI SHALL include Vitest tests with `@testing-library/react` on jsdom for every exported component.
2. THE Xray_UI SHALL include a fast-check property test, as its own test, that for all Trace and Anatomy pairs the number of rendered Fractured_Bones equals the number of Fractured_Outcomes whose `ruleId` is mapped in Anatomy, with generated traces that include capping and deducting outcomes whose `amountAfterCents` is equal to and lower than `amountBeforeCents`, outcomes without amount fields, and blocking outcomes.
3. THE Xray_UI SHALL include a fast-check property test, as its own test, that for all Trace and Anatomy pairs rendering the same inputs twice yields identical HTML.
4. THE Xray_UI SHALL include a fast-check property test, as its own test, that for all Trace and Anatomy pairs the DrBonesChat text equals the concatenation produced by the Message_Builder from the same Trace and Anatomy.
5. THE Xray_UI SHALL include a test that fails when `fetch`, `XMLHttpRequest` or `WebSocket` is called during DrBonesChat render and message completion.
6. THE Xray_UI SHALL include a fast-check property test, as its own test, that for all Trace and Anatomy pairs in Reduced_Motion_Mode the rendered DOM contains no class matching `/(^|\s)anim-/` and the DrBonesChat shows full text without a typing phase.
7. THE Xray_UI SHALL include a domain-isolation test that scans `packages/xray-ui/src` for the Domain_Words as whole words, case-insensitively, excluding `__tests__` and skipping "case".
8. THE Xray_UI SHALL include a contrast test that computes WCAG contrast ratios for the text and background pairs defined in the Design_Tokens and requires at least 4.5 for normal text.
9. THE Xray_UI SHALL include a smoke test that renders the Demo_App XrayView without errors and with exactly two Fractured_Bones at each of the versions expense-v1, expense-v2 and expense-v3.
10. THE Xray_UI SHALL run each fast-check property with at least 100 iterations.
11. THE Xray_UI SHALL include a test that an outcome with `conditionMet` true, `effect` capping and `amountAfterCents` equal to `amountBeforeCents` renders a passed Bone with the state text "applied, no change", and that the same outcome with a lower `amountAfterCents` renders a fractured Bone.
12. THE Xray_UI SHALL include a test that a capping or deducting outcome with `conditionMet` true and without amount fields renders a passed Bone and not a fractured Bone.

### Requirement 19: Core Prerequisite, Amounts Before and After a Rule

**User Story:** As a developer of the X-ray view, I want every capping and deducting outcome to carry the amount before and after its rule, so that a Bone fractures only when its rule changed the decision.

#### Acceptance Criteria

1. THE Core SHALL add the optional fields `amountBeforeCents` and `amountAfterCents`, both integer cents, to the `RuleOutcome` type in `packages/core/src/types.ts`.
2. WHEN `evaluate` applies a deducting or capping rule whose `conditionMet` is true, THE Core SHALL set `amountBeforeCents` to the running amount of that rule scope immediately before the rule and `amountAfterCents` to the running amount of that scope immediately after the rule.
3. WHEN a deducting or capping rule has `conditionMet` false, THE Core SHALL set `amountBeforeCents` and `amountAfterCents` to the same running amount of that scope at that point.
4. THE Core SHALL leave `amountBeforeCents` and `amountAfterCents` absent on blocking outcomes.
5. THE Core SHALL keep its existing tests green except where the new evaluation order changes a number, and each test expectation that changes SHALL carry a comment with the new arithmetic.
6. THE Core SHALL keep `traceSchemaVersion` unchanged, because the new fields are optional additions.
7. THE Core SHALL introduce no domain word into `packages/core/src`.
8. WHEN `pnpm --filter @bones/core test` and `pnpm typecheck` are run after the change, THE Core SHALL pass all existing tests and report no type errors.
9. THE Core SHALL include a fast-check property test, as its own test with at least 100 iterations, that for every outcome of every Decision produced by `evaluate` that has both fields, `amountAfterCents` is an integer, is at least 0 and is less than or equal to `amountBeforeCents`.
10. THE Core change SHALL be implemented and committed before any Xray_UI implementation task that uses the Fractured_Outcome definition.
11. THE Core SHALL evaluate in the order blocking rules, then capping rules, then deducting rules, so that the capping pass runs before the deducting pass.
12. THE Core SHALL apply capping rules one at a time in ascending `rule.id` order, each setting the running amount of its scope to the lower of the running amount and its cap (never below 0), so that every capping outcome has its own `amountBeforeCents` and `amountAfterCents`.
13. THE Core SHALL apply deducting rules after the capping pass, one at a time in ascending `rule.id` order, each subtracting its deduction from the running amount of its scope (never below 0), so that every deducting outcome has its own `amountBeforeCents` and `amountAfterCents`.
14. THE Core SHALL list `ruleOutcomes` in evaluation order: blocking outcomes, then capping outcomes, then deducting outcomes.
15. THE Core SHALL update `.kiro/specs/core/requirements.md` (requirements 4.1 and 4.3) and `.kiro/specs/core/design.md` (the evaluate algorithm) to the new evaluation order.
16. THE Core SHALL update `packages/core/src/__tests__/fixtures/expense-scenarios.test.ts` so that the amount scope starts at `claimedTotalCents` (48000) and the signature case yields, for each of the rule sets expense-v1, expense-v2 and expense-v3: line-item-cap 48000 → 4800 (fractured), meal-limit cap 5000, 6000 and 7500 respectively 4800 → 4800 (applied, no change), alcohol-deducting 4800 → 4150 (fractured), result `partially_approved` and `amountCents` 4150.
