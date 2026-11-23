# Requirements Document

## Introduction

The Signature case screen of the expense-auditor works, but at 1600x900 it feels stiff next to the concept image `design/mockups/bones-7-retro-b.png`. A region-by-region comparison of the mockup with the current screenshot (reduced motion, 1600x900) shows these differences:

- Labels are boxed: `RULE VERSION`, `AI READ CONFIDENCE` and `X-RAY` sit in light plaques (`.xr-cpanel-plaque`, `controls.css`), and the receipt field chips ("1: Merchant") are dark boxes (`.xr-mark-tag`, `panels.css`). The result block has a dashed outline (`.xr-result[data-result="partially_approved"]`, `xray.css:472`), and the stamp has a dashed border (`.xr-glass-stamp`, `panels.css:168`).
- The AI answer card sits at the bottom of the stage, left of the skeleton. In the mockup it is a cracked glass card at the top centre, above the skull, with the stamp across it.
- The ECG line crosses the whole stage. In the mockup it starts at the fracture. Hotspots are hard cyan rings. In the mockup they are soft bone glows.
- The receipt is a flat cream rectangle in monospace. In the mockup it is white thermal paper, slightly tilted, on blue-grey X-ray film, with a red scan line across the total row.
- The control panel has a small knob, a round gauge and three separate plaques. The mockup has one panel with a rounded notch, a knob about twice as large with engraved v1/v2/v3, a rectangular cream VU meter with a red zone, a toggle and an amber lamp.
- The phone header says "Dr. Bones" and the footer has two boxed buttons. The mockup has a notch, "Dr. Bones · Radiologist", a skull avatar, teal bubbles, a thin progress bar and two pill buttons with icons.
- The header buttons are boxed, and the X-RAY ON pill is solid bright cyan.
- Typography mixes serif, sans and mono in many places.

This feature changes look only. Everything runs through the same components, tokens and guards as `.kiro/specs/visual-polish/` (called "visual-polish" below).

Boundaries:

- No change to `packages/core`. No change to any rule, trace, replay, override or export behaviour. All existing tests stay green. Tests that assert the old look change in the same commit as the code.
- All look and motion live in `packages/xray-ui` with domain-free names. The app only arranges components and passes data.
- The case-files app is out of scope. No sound. No canvas. No new fonts files. No change below 1280x720.
- `design/` stays reference-only. Mockup PNGs are never imported.

## Decisions

Doubts were resolved while writing this document. Each decision is binding for design and tasks.

1. **D1 Sans font.** visual-polish R22.2 allows exactly one bundled font file (Cormorant SC woff2, at most 30,720 B). No new font file is added. The one UI sans is the system stack `ui-sans-serif, "Helvetica Neue", Arial, sans-serif` at weight 400 or 500, exposed as the token `--xr-font-sans`. The serif token is `--xr-font-serif` (Cormorant SC, then Georgia). The mono token is `--xr-font-mono` (existing mono stack). visual-polish R22.2 stays unchanged.
2. **D2 Visual rules in app.css.** `apps/expense-auditor/src/styles/app.css` contains visual rules (`.app-button`, `.app-note`, `.app-live-form` and others). Decision: a new app guard rule in `no-visual-in-app.node.test.ts` forbids visual declarations (colour, border, background, shadow, font) in `app.css` except in the `body` rule. The visual styling of buttons, notes, the live form, the file button and the status line moves to xray-ui (new `styles/form.css` and the existing `sheet.css`/`header.css`), and `app.css` keeps only layout of app-owned wrappers (position, flex, gap, padding). This makes the live form reusable and satisfies the visual-polish R2 intent.
3. **D3 Reference size.** The user's review target is 1600x900. A new Playwright project `chromium-1600` (viewport 1600x900) holds the new reference screenshots for the start screen and the Signature case. The existing 1440x900 references are kept and updated on purpose in the last task only. Layout and scrollbar specs run at 1440x900, 1280x720 and 1600x900.
4. **D4 No new raster files by default.** Skull avatar for Dr. Bones reuses `dr-bones.webp`. The VU meter face, the film-blue backdrop, the paper curl shadow, the engraved labels and the notch are CSS and inline SVG. The raster budget stays at the current total of 648,598 B of 1,500,000 B (Asset_Budget). If the review shows that a CSS/SVG result is not close enough, at most 2 new webp files, each at most 120,000 B, may be added in `packages/xray-ui/src/assets` and exported from `assets/index.ts`. The task that adds one must list the file name and size.
5. **D5 Stamp.** The stamp keeps `stamp-frame.webp` as its frame image and loses its CSS dashed border. Text colour and background stay token-based and pass the contrast test.
6. **D6 Hover labels on receipt marks.** The mark label is always in the DOM and exposed to assistive technology (visually hidden at rest). It is shown visually on hover of the mark and when the linked Hotspot_Glow is hovered or focused (the mark is not focusable, A6). This keeps accessibility without the boxed look.
7. **D7 X-RAY pill.** The pill becomes a muted glass pill (translucent dark fill, cyan hairline border, cyan-tinted text). `--xr-bg-cyan-fill` is no longer used by the pill. The token stays for the lit lamp label.
8. **D8 Trip line.** The header shows "Trip: Mar 10 - Mar 20, 2024" today. The mockup does not show it. It stays in the DOM (visually hidden) in the header, passed through the `contextNote` prop. It is not shown visibly and is not moved to the Rule_Box.
9. **D9 Header action labels.** The visible labels "Download trace" and "Load another receipt" stay. The mockup's round icon-only look is not copied, because the labels carry meaning. They become ghost pills with a small icon.
10. **D10 Receipt in xray-ui.** The component and class names stay domain-free ("paper", "document", "mark", "film"). The words receipt, expense, alcohol, meal, trip and suspect never appear under `packages/xray-ui/src`.

### Amendments from design

The "Requirement adjustments" table in `design.md` (A1 to A9) was applied to this document: A1 (R3.2, R3.5, R10.4), A2 (R3.1), A3 (R3.3, R3.4), A4 (R5.2), A5 (R5.1, R5.11, R10.4), A6 (R4.8, R9.2, D6), A7 (R11.5, R11.8, R11.9), A8 (D8, R7.8) and A9 (D2). A10 changes nothing here.

## Glossary

- **Xray_UI**: The `@bones/xray-ui` package in `packages/xray-ui`.
- **App**: The `apps/expense-auditor` application.
- **Core**: The `@bones/core` package.
- **Signature_Screen**: The decision view of the Signature sample case at a 1600x900 viewport with reduced motion.
- **Mockup**: `design/mockups/bones-7-retro-b.png`.
- **Header_Bar**: The top bar with wordmark, tagline, X-RAY pill and header actions (`HeaderBar.tsx`, `HeaderAction.tsx`, `header.css`).
- **Xray_Pill**: The pill that reads "X-RAY ON" or "X-RAY OFF" in the Header_Bar.
- **Header_Action**: A secondary action in the Header_Bar.
- **Stage**: The lightbox centre area with skeleton, hotspots, glass card and ECG (`Stage.tsx`, `stage.css`).
- **Glass_Card**: The AI answer card (`GlassCard.tsx`, `AnswerCard.tsx`).
- **Overrule_Stamp**: The stamp "OVERRULED BY RULE" (`.xr-glass-stamp`).
- **Skeleton_Photo**: The skeleton image (`SkeletonPhoto.tsx`, `skeleton.webp`). The Skeleton_Photo box is its layout box (`.xr-photo`), which has transparent margins around the opaque skeleton pixels.
- **Ecg_Band**: The ECG line (`EcgBand.tsx`, `EcgLine.tsx`).
- **Hotspot_Glow**: The soft glow that marks a bone (`Hotspot.tsx`).
- **Document_Panel**: The left panel with the paper on the film, held by two clips (`DocumentPanel.tsx`, `FilmClip.tsx`).
- **Paper**: The thermal-paper sheet inside the Document_Panel.
- **Film_Backdrop**: The blue-grey X-ray film behind the Paper.
- **Scan_Line**: The red line across the row of the claimed total.
- **Field_Mark**: The cyan underline mark on a document field (class `.xr-mark`, label `.xr-mark-tag`).
- **Control_Panel**: The steel panel at the bottom left (`ControlPanel.tsx`, `controls.css`).
- **Panel_Label**: A text label on the Control_Panel (`.xr-cpanel-plaque`).
- **Knob_Dial**: The dial of the Knob (`.xr-pknob-dial`), measured by its `offsetWidth`.
- **Context_Note**: The visually hidden text in the Header_Bar passed through the `contextNote` prop of `HeaderBar.tsx`.
- **Knob**, **Meter**, **Toggle**, **Lamp**: The controls in `Knob.tsx`, `Meter.tsx`, `Toggle.tsx`, `Lamp.tsx`.
- **Doctor_Panel**: The phone-shaped Dr. Bones panel (`DoctorPanel.tsx`, `ChatLog.tsx`, `ResultFooter.tsx`).
- **Result_Line**: The line "PARTIALLY APPROVED $41.50" with a progress bar in the Result_Footer.
- **Live_Form**: The start-screen form for live extraction (`FormStrip.tsx`, `.app-live-form`).
- **Boxed_Element**: An element whose computed style has a visible border (width above 0 and non-transparent colour) or a non-transparent background colour or background image, or a box-shadow that is not `none`, forming a rectangle around its text.
- **Asset_Dir**: `packages/xray-ui/src/assets/`.
- **Asset_Budget**: 1,500,000 B.
- **Contrast_Pair**: A text token and the real background behind it, as measured by `contrast.test.ts`.
- **Reduced_Motion**: `prefers-reduced-motion: reduce` matches, or the `reducedMotion` prop is true.
- **Review_Checkpoint**: A task end at which the Signature_Screen screenshot is compared by the user with the Mockup.
- **Reference_Screenshot**: A stored PNG that a Playwright test compares against.

## Requirements

### Requirement 1: Global look and removal of boxed labels

**User Story:** As a viewer, I want labels to look engraved or printed on the instrument instead of stuck on in boxes, so that the screen reads like one physical device.

#### Acceptance Criteria

1. THE Xray_UI SHALL render each of the elements `.xr-cpanel-plaque` (Panel_Label), `.xr-mark-tag` and the Doctor_Panel name label with computed `border-top-width`, `border-right-width`, `border-bottom-width` and `border-left-width` of 0, computed `background-color` of `rgba(0, 0, 0, 0)`, computed `background-image` of `none` and computed `box-shadow` of `none`.
2. THE Xray_UI SHALL render no element on the Signature_Screen with a computed `border-style` of `dashed` or `dotted`.
3. THE Xray_UI SHALL remove the rule `.xr-result[data-result="partially_approved"] { border-style: dashed }` in `packages/xray-ui/src/styles/xray.css` and SHALL remove the `border: 2px dashed` declaration of `.xr-glass-stamp` in `packages/xray-ui/src/styles/panels.css`.
4. WHERE the result block of the Doctor_Panel is rendered for any of the three results approved, partially approved and rejected, THE Xray_UI SHALL render it with no outline and no border whose `outline-style` or `border-style` is `dashed`.
5. THE Xray_UI SHALL define the new visual values as `--xr-*` tokens in `packages/xray-ui/src/styles/tokens.css`, and THE Xray_UI SHALL keep each new text colour token paired with its background token as in the existing file.
6. WHEN the Signature_Screen is rendered at 1600x900, THE Xray_UI SHALL show no element with a visible rectangular border around plain text other than the Glass_Card, the Rule_Box, the Doctor_Panel bubbles and the pill buttons.

### Requirement 2: Typography

**User Story:** As a viewer, I want one consistent type system, so that the screen looks designed instead of assembled.

#### Acceptance Criteria

1. THE Xray_UI SHALL define the tokens `--xr-font-serif`, `--xr-font-sans` and `--xr-font-mono` in `tokens.css`, with `--xr-font-sans` set to `ui-sans-serif, "Helvetica Neue", Arial, sans-serif`.
2. THE Xray_UI SHALL apply `--xr-font-serif` only to the Header_Bar wordmark and to the start-screen headline, so that no other element on the Signature_Screen or the start screen has a computed `font-family` that begins with "Cormorant SC".
3. THE Xray_UI SHALL apply `--xr-font-mono` only inside the Paper, so that no element outside the Paper has a computed `font-family` that contains `monospace`, `Menlo` or `Consolas` on the Signature_Screen.
4. THE Xray_UI SHALL apply `--xr-font-sans` to every other text element, with a computed `font-weight` of 400 or 500 for each of them, except the wordmark and the headline.
5. THE Xray_UI SHALL contain exactly one font file in woff2 format of at most 30,720 B (Cormorant SC) and no other font file, and the `fonts.test.ts` test SHALL keep passing.
6. THE Xray_UI SHALL make 0 network requests to an external font host during page load.
7. IF the Cormorant SC file fails to load, THEN THE Header_Bar SHALL render the wordmark in the fallback serif stack and keep the layout of the tagline, pill and actions unchanged.

### Requirement 3: Stage composition

**User Story:** As a viewer, I want the cracked AI answer above the skull and the skeleton large in the middle, so that the picture tells the story at first glance.

#### Acceptance Criteria

1. WHEN the Signature_Screen is rendered at 1600x900, THE Glass_Card SHALL be placed so that its horizontal centre is within 5 percent of the Stage width of the horizontal centre of the Skeleton_Photo, and its bottom edge is above the top of the rib cage, which is 22 percent of the Skeleton_Photo height from its top.
2. WHEN the Signature_Screen is rendered at 1600x900, THE Glass_Card SHALL NOT overlap the Document_Panel, the Doctor_Panel, the Control_Panel or the Header_Bar, and its width SHALL be between 35 and 55 percent of the Stage width. The Glass_Card MAY overlap the upper 22 percent of the Skeleton_Photo box (the skull, see R10.4).
3. THE Glass_Card SHALL keep its glass look (translucent fill, backdrop blur, `glass-cracks.webp` overlay) and SHALL render cracks over the full card area, with each field row (label, value and confidence) readable at a contrast of at least 4.5:1. In every row the confidence SHALL be shown on its own line under the value, in the same position for every row, at an effective font size of at least 10 px, so that a long value wraps but never pushes the confidence beside it. (Checkpoint 12) There SHALL be at least 12 CSS pixels between the "AI answer" title and the first row and at least 6 CSS pixels between rows; at 1600x900 and 1440x900 all four rows SHALL stay visible without scrolling inside the card, at 1280x720 the card MAY scroll inside.
4. THE Overrule_Stamp SHALL be placed inside the bounding box of the Glass_Card, in a reserved empty strip below the last field row, rotated between -20 and -5 degrees, with the horizontal centre of its bounding box within the central 60 percent of the Glass_Card width, so that it overlaps visible crack pixels of `glass-cracks.webp`. THE drawn (rotated) shape of the Overrule_Stamp SHALL NOT intersect the bounding box of any field value, confidence text or badge, and the Overrule_Stamp text SHALL meet a contrast of at least 4.5:1 on its own fill.
5. WHEN the Signature_Screen is rendered at 1600x900, THE Skeleton_Photo box SHALL be aligned to the bottom of the Stage and horizontally centred in the Stage with its centre within 2 percent of the Stage width of the Stage centre, SHALL have a rendered height of 91.5 percent of the Stage height (at least 90 percent), and SHALL be cropped by the bottom edge of the Stage at the thigh level, with the visible part ending between 60 and 70 percent of the source image height.
6. WHERE a result contains a fractured bone, THE Ecg_Band SHALL start at the horizontal position of the centre of the fractured Hotspot_Glow (within 8 CSS pixels) and SHALL extend to the right edge of the Stage, so that no part of the Ecg_Band lies to the left of the fractured Hotspot_Glow.
7. WHERE a result contains no fractured bone, THE Ecg_Band SHALL start at the horizontal centre of the Skeleton_Photo.
8. THE Ecg_Band SHALL spike in `--xr-red` at the fracture position and SHALL use `--xr-cyan` elsewhere, as before.
9. THE Hotspot_Glow SHALL be rendered as a radial gradient or blurred shape without a ring outline, so that its computed `border-top-width` is 0, its `border-radius` is 50 percent and its `filter` or background contains a blur or radial gradient.
10. THE Hotspot_Glow SHALL stay a focusable element of at least 24x24 CSS pixels with a visible focus ring of at least 3:1 contrast against its surrounding background, and the focus ring SHALL be an outline, not part of the glow.
11. WHILE a bone is fractured, THE Hotspot_Glow of that bone SHALL use `--xr-red-glow`, and WHILE a bone has passed, THE Hotspot_Glow SHALL use `--xr-cyan-glow`.
12. WHEN the pointer hovers a Hotspot_Glow or the Hotspot_Glow has focus, THE Stage SHALL show the Rule_Box joined to the bone by a thin line, as before.

### Requirement 4: Receipt paper on film

**User Story:** As a viewer, I want the source document to look like a real receipt hung on X-ray film, so that "the AI reads a real thing" is obvious.

#### Acceptance Criteria

1. THE Paper SHALL have a computed `background-color` that is white or near white (each RGB channel at least 235) and text colour `--xr-text-on-paper`, with a contrast of at least 4.5:1 on the Paper background.
2. THE Paper SHALL be rotated by a transform between 1 and 4 degrees in absolute value and SHALL show a curled shadow made of a `box-shadow` or a `filter: drop-shadow` plus a pseudo-element gradient, without any raster file beyond `paper.webp`.
3. THE Document_Panel SHALL show the Film_Backdrop behind the Paper with a blue-grey background (the blue channel greater than the red channel by at least 10 on the average colour of the area), THE Film_Backdrop height SHALL equal the Document_Panel height, THE Paper width SHALL be 65 to 70 percent of the Film_Backdrop width and centred, and the Film_Backdrop SHALL show at least 24 CSS pixels on the left, on the right and below the Paper at 1600x900, 1440x900 and 1280x720.
4. THE Document_Panel SHALL show exactly two clips (`FilmClip.tsx`) that touch the upper edge of the Film_Backdrop, and each clip SHALL be horizontally inside the Film_Backdrop.
5. THE Paper text SHALL use `--xr-font-mono` and SHALL keep all existing text content unchanged.
6. THE Field_Mark SHALL be rendered as a cyan underline of 1 CSS pixel in `--xr-cyan` at an opacity (alpha) between 0.3 and 0.4 at rest, with a width within 2 CSS pixels of the width of the marked text (not the width of the Paper), and SHALL have no side or top border and no background fill; WHEN the pointer hovers the Field_Mark or the linked Hotspot_Glow is highlighted, THE Field_Mark SHALL change to opacity 1 with a soft glow (`box-shadow` or `filter` with `--xr-cyan-glow`).
7. THE Field_Mark label (`.xr-mark-tag`) SHALL stay in the DOM with its text (for example "1: Merchant") and SHALL be visually hidden at rest (opacity 0 or clipped), without `display: none` and without `visibility: hidden`, so that assistive technology can still read it.
8. WHEN the pointer hovers a Field_Mark or the linked Hotspot_Glow is hovered or has focus, THE Field_Mark SHALL show its label visibly (opacity 1, within 200 ms), and WHILE Reduced_Motion is active THE label SHALL appear at once without transition.
9. WHERE the claimed total is shown, THE Scan_Line SHALL be a red line (`--xr-red`, 1 to 3 CSS pixels high) whose vertical centre is within 6 CSS pixels of the vertical centre of the row of the claimed total, and whose width covers at least 90 percent of the Paper width, with a soft red glow.
10. THE Scan_Line SHALL NOT move when Reduced_Motion is active, and WHERE Reduced_Motion is not active THE Scan_Line MAY pulse with `opacity` only.
11. THE Xray_UI SHALL keep the Document_Panel fully inside the Lightbox at 1600x900, 1440x900 and 1280x720 and SHALL NOT overlap it with the Stage or the Control_Panel.

### Requirement 5: Control panel

**User Story:** As a viewer, I want the controls to look like one real device panel, so that the instrument feels physical and the knob is easy to hit.

#### Acceptance Criteria

1. THE Control_Panel SHALL be one surface with the brushed-steel background, one `border-radius` (not 0) on the outer corners, and a rounded notch where it meets the Lightbox, so that the Knob, the Meter, the Toggle and the Lamp share one background and no inner panel or plaque draws a second box. THE Control_Panel MAY overlap the transparent margin of the Skeleton_Photo box, and SHALL NOT overlap its opaque pixels.
2. THE Knob_Dial SHALL have a rendered diameter of at least 1.8 times and at most 2.2 times the diameter of the Knob_Dial before this feature (`Knob.tsx` as in the commit before this feature) at the same viewport, and THE task that changes the size SHALL record the old and new pixel values in its commit message. THE Knob_Dial SHALL be vertically centred on the Meter within 4 CSS pixels and THE Meter SHALL be at most 15 percent taller or shorter than the Knob_Dial.
3. THE Knob SHALL show the engraved labels "v1", "v2" and "v3" around it as text on the metal, with computed border width 0 and background `rgba(0, 0, 0, 0)`, and with the label of the active version at a higher contrast than the others. THE labels SHALL sit on one tight arc (v1 lower left, v2 top centre, v3 lower right), each label centre at most 20 CSS pixels from the visible dial edge, each with a short engraved tick pointing at it from the dial, and THE Panel_Label "RULE VERSION" SHALL sit above the top of the Knob and its labels, clear of the "v2" label.
4. THE Knob SHALL keep `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` and its keyboard operation (arrow keys, Home, End), and the current rule version SHALL stay unchanged by any visual change.
5. THE Meter SHALL be a rectangle with a cream face and a red zone (the last 25 percent of the scale, from 0.75 to 1.0) instead of the round gauge, with an outer rounded rectangular bezel, an analog needle and printed scale marks. THE scale numbers SHALL render at an effective font size of at least 11 CSS pixels (SVG font size times the SVG scale) at 1600x900, 1440x900 and 1280x720, and THE Control_Panel SHALL leave at least 16 CSS pixels of steel between the Meter and the bottom edge of the Control_Panel.
6. THE Meter SHALL keep `role="meter"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext`, and the needle position SHALL be derived from the same confidence value as before.
7. THE Meter SHALL render the needle with `transform` only, and WHILE Reduced_Motion is active THE Meter SHALL show the needle at its final position without movement.
8. THE Toggle SHALL be drawn with CSS and SVG only (no `<img>`) as a silver metal toggle: a round chrome base plate with a gradient bezel and a short tapered lever with a ball tip, and THE lever SHALL tilt up WHILE the Toggle is on and down WHILE it is off, by `transform` only with a transition of at most 150 ms and none under Reduced_Motion. THE Toggle SHALL keep `role="switch"` and `aria-checked`, and THE Lamp SHALL be amber (`--xr-amber-glow`) next to the Toggle and SHALL be lit while the Toggle is on.
9. THE Control_Panel SHALL show the three Panel_Labels "RULE VERSION", "AI READ CONFIDENCE" and "X-RAY" as engraved text (a text colour from the token `--xr-text-on-steel` and a `text-shadow` that has a light 1 px offset highlight), without box, and each label SHALL be within 40 CSS pixels (vertical gap) of the control it names, with the label horizontally centred under or over that control within 8 CSS pixels. "RULE VERSION" and "AI READ CONFIDENCE" SHALL share one baseline within 2 CSS pixels.
10. THE Panel_Label text colour SHALL reach a contrast of at least 4.5:1 against the brushed-steel pixels behind it, as measured by the contrast test on the real image average.
11. THE Control_Panel SHALL keep fully visible at 1600x900, 1440x900 and 1280x720, without overlapping the Document_Panel, the Doctor_Panel or the opaque pixels of the Skeleton_Photo.
12. WHEN the user turns the Knob, THE Xray_UI SHALL replay the decision with the chosen rule version as before.

### Requirement 6: Phone panel

**User Story:** As a viewer, I want Dr. Bones to look like a chat on a phone, so that the explanation feels familiar and friendly.

#### Acceptance Criteria

1. THE Doctor_Panel SHALL show a top notch (a dark rounded pill shape centred at the top edge, with a width between 60 and 140 CSS pixels) and SHALL show a bottom home indicator line, both decorative and `aria-hidden="true"`.
2. THE Doctor_Panel header SHALL show the text "Dr. Bones · Radiologist" and a round skull avatar using `dr-bones.webp` with `alt=""` and `aria-hidden="true"`, and the avatar SHALL be at least 40 CSS pixels in diameter.
3. THE Doctor_Panel SHALL render Dr. Bones messages as teal bubbles with a background derived from the tokens `--xr-bg-bubble` and `--xr-text-bubble` (the token values MAY change to a teal), with a contrast of at least 4.5:1, and with a corner radius of at least 12 CSS pixels.
4. THE Doctor_Panel SHALL keep each message text unchanged, as produced from the rule message templates and the trace.
5. THE Result_Footer SHALL show the Result_Line as "PARTIALLY APPROVED $41.50" for the Signature case, in the format `<RESULT LABEL> <amount>` in upper-case letters, followed by a thin progress bar of 2 to 6 CSS pixels in height, with no border and no dashed outline.
6. THE progress bar SHALL show the ratio approved amount to claimed amount as its filled width (rounded to the nearest 1 percent), SHALL use `role="progressbar"` with `aria-valuemin="0"`, `aria-valuemax="100"` and `aria-valuenow`, and SHALL stay at the final width when Reduced_Motion is active.
7. THE Result_Footer SHALL show two pill buttons "Replay decision" and "Human override", each with `border-radius` of at least half of its height, each with an inline SVG icon (`aria-hidden="true"`) before its text, and each with a bounding box at least 44 CSS pixels high.
8. WHEN the user activates "Replay decision" or "Human override" by mouse, touch or keyboard (Enter or Space), THE App SHALL perform the same action as before this feature.
9. WHILE the chat text is taller than the Doctor_Panel body, THE Doctor_Panel body SHALL scroll inside its own box, and THE page SHALL stay free of scrollbars.
10. THE Doctor_Panel SHALL keep its chat log semantic (`role="log"` or the role it has today) and the typed-out text behaviour, and WHILE Reduced_Motion is active THE Doctor_Panel SHALL show all text at once.

### Requirement 7: Header

**User Story:** As a viewer, I want a quiet framed header, so that the instrument is the hero and the header supports it.

#### Acceptance Criteria

1. THE Header_Bar SHALL be a rounded framed bar: one `border-radius` of at least 12 CSS pixels, a 1 px hairline border in a muted cyan or steel colour from a token, and a dark translucent fill, spanning between 90 and 100 percent of the viewport width.
2. THE Header_Bar SHALL show the wordmark "BONES" in `--xr-font-serif` and the tagline "the skeleton under every AI decision" in `--xr-font-sans`, with the tagline starting 8 to 24 CSS pixels to the right of the wordmark on the same row.
3. WHILE the Toggle is on, THE Xray_Pill SHALL show "X-RAY ON", and WHILE the Toggle is off, THE Xray_Pill SHALL show "X-RAY OFF", with the pill centre within 2 CSS pixels of the horizontal centre of the Header_Bar.
4. THE Xray_Pill SHALL be a muted glass pill: a computed `background-color` with an alpha of at most 0.35, a 1 px border in a cyan token, text in `--xr-cyan` or a cyan-tinted token, and its background SHALL NOT equal `--xr-bg-cyan-fill`.
5. THE Xray_Pill text SHALL reach a contrast of at least 4.5:1 on the real background behind it.
6. THE Header_Action elements "Download trace" and "Load another receipt" SHALL be ghost pills: `border-radius` of at least half of the height, background alpha of at most 0.1, 1 px hairline border, and a small inline SVG icon with `aria-hidden="true"`, aligned to the right edge of the Header_Bar and separated from each other by a gap of at least 8 CSS pixels.
7. WHEN the user activates a Header_Action by mouse, touch or keyboard (Enter or Space), THE App SHALL perform the same action as before this feature.
8. THE Header_Bar SHALL NOT show the "Trip: ..." text visibly (see D8), and the text SHALL stay in the DOM and in the accessibility tree through the `contextNote` prop.
9. THE App SHALL keep exactly one `h1` in the document, visually hidden and exposed to the accessibility tree.

### Requirement 8: Start screen and live form

**User Story:** As a first-time viewer, I want the start screen and the upload form to match the instrument, so that nothing looks like a default browser page.

#### Acceptance Criteria

1. THE Live_Form SHALL render its visual styling (colour, border, background, shadow, font, radius) from `packages/xray-ui/src/styles` and SHALL follow the Control_Panel look: brushed-steel surface or glass surface, engraved labels without boxes, and pill-shaped or rounded controls.
2. THE Live_Form SHALL replace the native file input look with a custom file button: the native `input[type="file"]` SHALL stay in the DOM (visually hidden, not `display: none`), SHALL stay keyboard-focusable through its label, and the visible button SHALL show a focus ring of at least 3:1 contrast when the input has focus.
3. THE custom file button SHALL show the chosen file name after a file is chosen, and WHILE no file is chosen it SHALL show the text "Choose a photo" or the text the App passes today.
4. THE Live_Form text input, select and submit button SHALL each have computed `appearance` of `none`, a `font-family` equal to `--xr-font-sans`, and a minimum height of 44 CSS pixels.
5. THE start-screen headline SHALL use `--xr-font-serif`, and the Film_Sheet cards SHALL keep their title and one-line description unchanged.
6. THE start screen SHALL fit in the viewport at 1600x900, 1440x900 and 1280x720 without page scroll.
7. WHEN the user submits the Live_Form, THE App SHALL perform the same request and flow as before this feature, and no API key SHALL appear in the client bundle.
8. IF the live extraction is off (`LIVE_EXTRACTION=off`), THEN THE App SHALL keep hiding the Live_Form as before.
9. (Checkpoint 12) EACH start card SHALL show a paper thumbnail in the Paper style of R4 (warm white `--xr-bg-paper-doc`, curl, shadow, clip), tilted by a deterministic angle derived from the card title, between -3 and +3 degrees and not equal for all cards, with 3 to 5 text lines in `--xr-font-mono` at a contrast of at least 4.5:1. THE lines SHALL be passed by the App as data (`lines: string[]`, from the recorded receipt: merchant, first two items with prices, printed total), SHALL NOT name or hint at the result, and the thumbnail SHALL be `aria-hidden`, so that the accessible name stays the title and the description stays the one-line description. No new raster image.
10. (Checkpoint 12) EACH start card SHALL be a blue-grey film sheet without a border (computed border width 0, no dashed or dotted line), with rounded corners, a faint X-ray texture from CSS gradients and a soft inner glow. WHEN the pointer hovers the card or the card has keyboard focus, THE card SHALL lift by 4 CSS pixels and its cyan glow SHALL become stronger, using transform and opacity only; keyboard focus SHALL keep a visible ring of at least 3:1, and under Reduced_Motion the transitions SHALL be none.
11. (Checkpoint 12) WHILE the Live_Form is hidden, THE headline and the row of cards SHALL form one block whose vertical centre is within 24 CSS pixels of the stage centre at 1600x900, 1440x900 and 1280x720. WHILE the Live_Form is shown, the earlier layout SHALL stay, with no overlap and no page scroll. The arrangement SHALL come from `packages/xray-ui` (`StartLayout`, `data-form`), not from app CSS.

### Requirement 9: Accessibility, reduced motion and contrast preserved

**User Story:** As a user with assistive technology or motion sensitivity, I want the new look to stay usable, so that polish does not cost access.

#### Acceptance Criteria

1. THE Xray_UI SHALL keep the roles `slider` on the Knob, `meter` on the Meter and `switch` on the Toggle, and the a11y-roles test SHALL keep passing.
2. THE Xray_UI SHALL show a focus ring of at least 3:1 contrast and at least 3 CSS pixels wide on every interactive element (Knob, Toggle, Hotspot_Glow, Header_Action, pill buttons, file button, form controls) when it has keyboard focus.
3. THE Xray_UI SHALL reach a text contrast of at least 4.5:1 for each Contrast_Pair on its real background, including every pair added or changed by this feature, and THE contrast test SHALL list each new pair.
4. THE Xray_UI SHALL mark each purely decorative image or SVG (notch, home indicator, avatar, icons, curl shadow, engraved ticks, clips) with `aria-hidden="true"` or `alt=""`.
5. THE Xray_UI SHALL define every animation and `@keyframes` rule only in files under `packages/xray-ui/src/styles/`, SHALL animate only `transform`, `opacity` and `filter`, and SHALL disable each animation under `@media (prefers-reduced-motion: reduce)` and under the `reducedMotion` prop.
6. WHILE Reduced_Motion is active, THE Xray_UI SHALL show the Signature_Screen in its final state without running animation, and SHALL show the same layout as WHILE Reduced_Motion is not active.
7. THE Xray_UI SHALL contain 0 matches of the words receipt, expense, alcohol, meal, trip and suspect (case-insensitive) in `.ts`, `.tsx` and `.css` files under `packages/xray-ui/src`.
8. THE Xray_UI SHALL contain `url()` references only to files in Asset_Dir, and SHALL keep sound off.
9. THE Xray_UI SHALL put all text content of this feature (labels, hover marks) in English.

### Requirement 10: Layout without page scroll

**User Story:** As a viewer, I want the whole screen to fit, so that I see a finished instrument.

#### Acceptance Criteria

1. WHEN the viewport is 1600x900, THE Signature_Screen SHALL have `document.documentElement.scrollHeight` and `scrollWidth` less than or equal to the viewport height and width.
2. WHEN the viewport is 1440x900, THE Signature_Screen SHALL have `scrollHeight` and `scrollWidth` less than or equal to the viewport height and width.
3. WHEN the viewport is 1280x720, THE Signature_Screen SHALL have `scrollHeight` and `scrollWidth` less than or equal to the viewport height and width.
4. WHEN the viewport is 1600x900, 1440x900 or 1280x720, THE Signature_Screen SHALL render the Document_Panel, the Glass_Card, the Skeleton_Photo, the Doctor_Panel and the Control_Panel fully inside the viewport, with no overlap between them except the Control_Panel overlapping the steel frame and the transparent margin of the Skeleton_Photo box (not its opaque pixels), the Glass_Card overlapping the upper 22 percent of the Skeleton_Photo box (the skull), and the Overrule_Stamp overlapping the Glass_Card.
5. THE Xray_UI SHALL scale all new measurements through `--xr-u` (the existing unit) or percentages, so that no new fixed pixel size larger than 120 CSS pixels is added outside the Knob and the Meter base sizes.
6. THE start screen SHALL follow criteria 1 to 3 at the same three viewports.

### Requirement 11: Tests, screenshot references and review checkpoints

**User Story:** As the product owner, I want automated checks and my own screenshot review at every step, so that "like the mockup" is judged by me, not assumed.

#### Acceptance Criteria

1. THE App SHALL add a Playwright project `chromium-1600` with viewport 1600x900, `reducedMotion: "reduce"` and `colorScheme: "dark"`, and a spec that captures the start screen and the Signature_Screen as Reference_Screenshots for this project, stored next to the existing references under `apps/expense-auditor/e2e/__screenshots__/`.
2. THE App SHALL keep the layout and scrollbar specs running at 1440x900 and 1280x720, and SHALL add 1600x900 to them.
3. THE Playwright config SHALL keep `updateSnapshots: "none"`, so that a missing reference fails.
4. THE App SHALL add e2e assertions for the measurable criteria: bounding-box relations of Requirement 3 (Glass_Card above skeleton and centred, stamp inside card, ECG start at fracture), computed-style checks of Requirement 1 (no border and no background on label elements, no dashed style anywhere), DOM roles of Requirement 9, and no page scroll of Requirement 10.
5. THE Xray_UI SHALL update the contrast test, css-constants test, fonts test and the guard tests in the same commit as the code that changes the asserted look, and the full suite (`pnpm test`, typecheck, lint, e2e) SHALL pass at the end of each task, except that the two 1440x900 reference tests (`start-screen`, `signature-case`) SHALL be skipped with a one-line reason from the first look-changing task to the second-to-last task.
6. THE tasks SHALL be grouped into Review_Checkpoints, and at each Review_Checkpoint the agent SHALL take a 1600x900 screenshot of the Signature_Screen and of the start screen, store them in the repository under `.kiro/specs/visual-polish-2/review/` with the checkpoint number in the file name, and ask the user to compare them with the Mockup region by region.
7. THE agent SHALL NOT mark a checkpoint as done before the user has reviewed its screenshots, and SHALL record the user's verdict (accepted or list of changes) in `tasks.md`.
8. THE agent SHALL regenerate the Reference_Screenshots of the `chromium-1600` project on purpose (`--update-snapshots` for that spec only) at the end of each task, the user SHALL ratify them at the Review_Checkpoint, and the agent SHALL NOT update references of other specs or projects in that commit.
9. THE final task SHALL regenerate the two skipped 1440x900 Reference_Screenshots on purpose and remove the skip, after the 1600x900 references are accepted, and SHALL list each updated file in the commit message.
10. THE final task SHALL produce a side-by-side image of the Mockup and the final Signature_Screen at 1600x900 for the user's last review.

### Requirement 12: Asset budget

**User Story:** As a maintainer, I want the visual upgrade to stay light, so that the demo loads fast.

#### Acceptance Criteria

1. THE Xray_UI SHALL keep the total size of Asset_Dir at most Asset_Budget (1,500,000 B), measured as the sum of file sizes of all files in Asset_Dir and its subfolders, with a starting total of 648,598 B.
2. THE Xray_UI SHALL implement the VU meter face, the film backdrop, the paper curl shadow, the notch and the engraved labels with CSS and inline SVG, so that the number of new raster files is 0 by default (D4).
3. WHERE a new raster file is needed, THE Xray_UI SHALL add at most 2 new `.webp` files in Asset_Dir, each at most 120,000 B, each exported by name from `assets/index.ts`, and the task SHALL list each file name and byte size in its commit message.
4. THE Xray_UI SHALL bundle no new font file (D1), so that the font file count stays at 1 with at most 30,720 B.
5. THE Xray_UI SHALL declare a positive integer `width` and `height` on every `img` element it renders.
6. IF the total size of Asset_Dir exceeds Asset_Budget, THEN THE asset-budget test SHALL fail with a message that contains the measured total and the budget.

### Requirement 13: Superseded earlier requirements

**User Story:** As a maintainer, I want to know which earlier requirements this feature replaces, so that old tests and documents do not contradict the new look.

#### Acceptance Criteria

1. THE Xray_UI SHALL treat visual-polish R3.4 (placement of the Glass_Card in the Shell) as superseded by Requirement 3 of this document, and visual-polish R7 (Glass_Card position and Overrule_Stamp placement and dashed look) as superseded by Requirements 1 and 3.
2. THE Xray_UI SHALL treat visual-polish R4 (header pill look, solid cyan pill and boxed actions) as superseded by Requirement 7, and the visual-polish R4.7 hidden `h1` and R4.8 rules as kept.
3. THE Xray_UI SHALL treat visual-polish R6 (document panel look: cream paper, chips) as superseded by Requirement 4.
4. THE Xray_UI SHALL treat visual-polish R8 (doctor panel header text "Dr. Bones" and boxed footer buttons) as superseded by Requirement 6, with the header text becoming "Dr. Bones · Radiologist".
5. THE Xray_UI SHALL treat visual-polish R9 (round gauge, plaques, small knob) as superseded by Requirement 5, with the round gauge replaced by the rectangular VU meter.
6. THE Xray_UI SHALL treat visual-polish R10 (hotspot rings) as superseded by Requirement 3 for the look only, and visual-polish R16 (start screen) as extended by Requirement 8.
7. THE Xray_UI SHALL keep visual-polish R1, R2, R3 (except R3.4), R5, R11 to R15, R17 to R22 in force, with R22.2 unchanged by D1.
8. WHEN a test or guard asserts a superseded look, THE commit that changes the code SHALL change that test in the same commit, with a one-line comment that names this document and the superseded requirement.
