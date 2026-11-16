# Requirements Document

## Introduction

The expense-auditor app works and is tested, but it looks like a generic dashboard. This feature gives it the look of the chosen concept image `design/mockups/bones-7-retro-b.png`, as close as a real web UI can get: a brushed-steel frame around a dark X-ray lightbox, a photographic skeleton with glowing bone hotspots, a frosted-glass AI answer card that cracks, a phone-shaped Dr. Bones panel, and a metal control panel with a bakelite knob, an analog meter and a chrome toggle. The quality bar is that a hackathon jury says "wow" within three seconds.

Secondary references: `bones-5-final-a.png` (hover box with a line to the bone), `bones-3-hover-doctor-a.png` (ECG line, Dr. Bones panel), `bones-4-fracture-a.png` (splinters, cracked glass card). The asset list, blend modes and bone anchor coordinates come from `design/assets/README.md`.

Boundaries of this feature:

- All look and motion live in `packages/xray-ui` with domain-free names ("paper", "document", never "receipt"). The app only arranges components and passes data.
- No change to `packages/core`. No change to any rule, trace, replay, override or export behaviour of the app. Every existing test keeps passing, except guard tests that are updated on purpose (Requirement 15).
- The Anatomy API keeps its shape. An anchor table inside xray-ui maps each `Region` to image coordinates.
- Reference-only status of `design/` stays: the mockup PNGs are never imported. Only the files of `design/assets/` are copied into xray-ui.

### Out of scope

- A canvas layer (SVG, CSS and Web Animations only; the existing `<canvas` guard stays).
- Sound of any kind.
- The case-files app.
- New rules, new sample cases or new trace fields.
- Mobile and touch-first layouts below 1280x720.

## Glossary

- **Xray_UI**: The `@bones/xray-ui` package in `packages/xray-ui`.
- **App**: The `apps/expense-auditor` application.
- **Core**: The `@bones/core` package.
- **Shell**: The full-screen composition made of the header bar, the steel frame, the lightbox and the control panel.
- **Header_Bar**: The top bar with the wordmark, the tagline, the X-RAY ON pill and the secondary actions.
- **Steel_Frame**: The brushed-steel border around the lightbox, with four corner screws and an inner bevel.
- **Lightbox**: The dark viewing area inside the Steel_Frame with film background, light cone and skeleton.
- **Skeleton_Image**: `skeleton.webp`, the photographic skeleton shown cropped from skull to upper thigh.
- **Anchor_Table**: The table in Xray_UI that maps each `Region` to image-percent coordinates on the Skeleton_Image.
- **Hotspot**: An interactive element placed at an anchor, one per bone of the Anatomy.
- **Hotspot_State**: One of passed, applied-no-change, fractured, or not-applicable, derived from the existing `BoneView`.
- **Rule_Box**: The hover or focus box that shows a bone's rule text, joined to the Hotspot by a thin line.
- **Document_Panel**: The left panel where the paper strip hangs on the film, held by two clips.
- **Glass_Card**: The frosted-glass AI answer card above the skull.
- **Overrule_Stamp**: The tilted stamp "OVERRULED BY RULE" made of `stamp-frame.webp` and text in code.
- **Doctor_Panel**: The phone-shaped Dr. Bones panel on the right.
- **Result_Footer**: The bottom block of the Doctor_Panel with result line, progress bar and the two action buttons.
- **Control_Panel**: The brushed-steel panel at the bottom left that overlaps the Steel_Frame and holds the Knob, the Meter and the Toggle with its Lamp.
- **Knob**: The rule-version rotary control (`role="slider"`).
- **Meter**: The AI-confidence analog meter (`role="meter"`).
- **Toggle**: The X-ray switch (`role="switch"`).
- **Lamp**: The amber lamp next to the Toggle.
- **Film_Sheet**: A start-screen card that looks like an X-ray film sheet clipped to the lightbox, one per sample case.
- **Intro**: The one-time power-on sequence that follows loading a case.
- **Fracture_Moment**: The animation sequence played when a bone is shown fractured.
- **Reduced_Motion**: The state in which `prefers-reduced-motion: reduce` matches or the `reducedMotion` prop is true.
- **Asset_Dir**: `packages/xray-ui/src/assets/`.
- **Asset_Budget**: 1.5 MB, the maximum total size of all files added to Asset_Dir.
- **Contrast_Ratio**: The WCAG 2.x contrast ratio between a text colour and the colour behind it.
- **Reference_Screenshot**: A stored PNG that a Playwright test compares against.
- **Guard_Tests**: The source-scanning tests in Xray_UI and App (source hygiene, Lightbox and AnswerCard style guards, reduced-motion guard, domain isolation, no-audio, no-auth).

## Requirements

### Requirement 1: Bundled asset set

**User Story:** As a developer, I want the visual assets bundled inside xray-ui, so that every app that uses the library gets the same look without extra setup.

#### Acceptance Criteria

1. THE Xray_UI SHALL contain, inside Asset_Dir, every file listed in `design/assets/README.md`, with each splinter file located in `Asset_Dir/splinters/` and each file's byte content identical to its source file in `design/assets/`.
2. THE Xray_UI SHALL name the copied paper image `paper.webp` instead of `receipt-paper.webp`, and THE Xray_UI SHALL NOT contain a file named `receipt-paper.webp` in Asset_Dir.
3. WHEN the production build of Xray_UI or of App completes, THE build SHALL emit every image from Asset_Dir under a file name that contains a content hash, and every image SHALL be referenced through a Vite module import.
4. THE Xray_UI SHALL expose the URL of every image in Asset_Dir as a named string export of the single module `assets/index.ts`, and no other module SHALL export an Asset_Dir image URL.
5. THE total size of the files in Asset_Dir SHALL be at most Asset_Budget, measured as the sum of file sizes in bytes of all files in Asset_Dir and its subfolders.
6. WHEN the first paint of the Xray_UI renders, THE Xray_UI SHALL render every image that is visible on first paint without the `loading="lazy"` attribute and without deferred loading.
7. THE Xray_UI SHALL declare image module types (including `.webp`) so that `tsc --noEmit` completes with zero errors in Xray_UI and in App.
8. IF a file listed in `design/assets/README.md` is missing from Asset_Dir, THEN THE Xray_UI test suite SHALL fail, and the failure output SHALL contain the name of each missing file.
9. IF the total size of the files in Asset_Dir exceeds Asset_Budget, THEN THE Xray_UI test suite SHALL fail, and the failure output SHALL contain the measured total size and the Asset_Budget value in bytes.

### Requirement 2: Domain-free ownership of look and motion

**User Story:** As a maintainer, I want all styling and motion in xray-ui, so that the case-files app can reuse the look.

#### Acceptance Criteria

1. THE Xray_UI SHALL contain every image reference, every `@keyframes` rule and every CSS `transition` declaration used by the new look, so that a search of the App source for these three constructs returns 0 matches.
2. THE App SHALL contain 0 image imports, 0 `url()` references and 0 `@keyframes` rules in its `.ts`, `.tsx` and `.css` files.
3. THE Xray_UI SHALL contain 0 case-insensitive matches for the words receipt, expense, alcohol, meal, trip and suspect in any `.ts`, `.tsx` or `.css` file under its `src/` directory.
4. WHEN the App renders the Shell, THE App SHALL pass only the document text, the Trace, the Anatomy, the rule versions and the callbacks to Xray_UI, and THE App SHALL set 0 position or style properties (inline styles, CSS rules or class-based layout rules) on the Shell elements.
5. IF a `.ts`, `.tsx` or `.css` file under the Xray_UI `src/` directory contains any of the words listed in criterion 3, THEN THE domain-isolation test SHALL fail with a message that names the file and the matched word.
6. IF a `.ts`, `.tsx` or `.css` file in the App contains an image import, a `url()` reference or an `@keyframes` rule, THEN THE App guard test SHALL fail with a message that names the file and the matched construct.

### Requirement 3: One-screen layout

**User Story:** As a viewer, I want the whole product on one screen, so that the first impression is a complete instrument instead of a scrolling page.

#### Acceptance Criteria

1. WHEN the viewport is 1440x900 pixels, THE Shell SHALL render all of its regions (Document_Panel, Glass_Card, Skeleton_Image, Doctor_Panel, Control_Panel) fully inside the viewport, with document scroll height and scroll width each less than or equal to the viewport height and width.
2. WHEN the viewport is 1280x720 pixels, THE Shell SHALL render all of its regions (Document_Panel, Glass_Card, Skeleton_Image, Doctor_Panel, Control_Panel) fully inside the viewport, with document scroll height and scroll width each less than or equal to the viewport height and width.
3. WHEN the viewport size changes to any width from 1280 to 1920 pixels and any height from 720 to 1080 pixels, THE Shell SHALL resize its layout within 100 ms so that every region stays fully inside the viewport and no page scrollbar appears.
4. THE Shell SHALL place the Document_Panel on the left, the Glass_Card above the Skeleton_Image in the centre, the Doctor_Panel on the right and the Control_Panel at the bottom left, with no two of these regions overlapping, except that the Control_Panel SHALL overlap the Steel_Frame as required by Requirement 9.
5. WHILE the chat text in the Doctor_Panel is taller than the Doctor_Panel body, THE Doctor_Panel body SHALL scroll vertically inside its own box and SHALL keep the page free of scrollbars.
6. IF the viewport is smaller than 1280x720 pixels, THEN THE Shell SHALL keep the layout at its 1280x720 size and allow the page to scroll, without hiding or overlapping any region.

### Requirement 4: Header bar

**User Story:** As a viewer, I want a clear header, so that I know what the product is before I read anything else.

#### Acceptance Criteria

1. THE Header_Bar SHALL show the wordmark "BONES" in the font Cormorant SC at weight 700, loaded through a custom `@font-face` in Xray_UI that points at the woff2 file `latin-700-normal.woff2` of the `@fontsource/cormorant-sc` package.
2. THE Header_Bar SHALL show the tagline "the skeleton under every AI decision" immediately to the right of the wordmark, on the same row, with a gap of 8 to 24 CSS pixels between them.
3. WHILE the Toggle is on, THE Header_Bar SHALL show the pill text "X-RAY ON" with the pill horizontally centred in the Header_Bar, with its centre within 2 CSS pixels of the Header_Bar's horizontal centre.
4. WHILE the Toggle is off, THE Header_Bar SHALL show the pill text "X-RAY OFF" in the same position and replace the text "X-RAY ON".
5. THE Header_Bar SHALL show "Download trace" and "Load another receipt" as two secondary actions aligned to the right edge of the Header_Bar, each rendered with a smaller font size and lower visual weight than the wordmark.
6. WHEN the user activates "Download trace" or "Load another receipt" by mouse click, touch, or keyboard (Enter or Space), THE App SHALL perform the same action it performed before this change.
7. THE App SHALL NOT render the "Expense Auditor" `h1` text or the plate label above the lightbox in the visible Shell.
8. THE App SHALL keep exactly one `h1` in the document for screen readers and focus management, hidden visually and still exposed to the accessibility tree.
9. IF the font files fail to load, THEN THE Header_Bar SHALL render the wordmark in a generic serif fallback font and keep the layout of the tagline, pill, and actions unchanged.
10. THE Xray_UI SHALL serve the Cormorant SC font file from the build output and make zero network requests to an external font host during page load.

### Requirement 5: Steel frame and lightbox

**User Story:** As a viewer, I want a metal frame around a glowing lightbox, so that the screen reads as a physical radiology instrument.

#### Acceptance Criteria

1. THE Steel_Frame SHALL use `brushed-steel.webp` as a tiled background with a tile size of 512 px by 512 px.
2. THE Steel_Frame SHALL show exactly four `screw.webp` instances, one in each corner, and each screw SHALL have a fixed rotation angle that differs from the rotation angle of each of the other three screws.
3. THE Steel_Frame SHALL show an inner bevel along its inner edge that consists of one inset highlight and one inset shadow.
4. THE Lightbox SHALL use `film.webp` as its background image, covering the full Lightbox area.
5. THE Lightbox SHALL show `light-cone.webp` horizontally centred at the top edge of the Lightbox with `mix-blend-mode: screen`.
6. THE Lightbox SHALL show the Skeleton_Image centred horizontally and vertically with `mix-blend-mode: screen`, cropped to the vertical range from 3 % to 65 % of the source image height.
7. WHILE the Toggle is off, THE Lightbox SHALL hide the Skeleton_Image, the light cone and the Hotspots, and SHALL show the document and the AI answer as flat content without the glow, blend mode or film background effects of the X-ray view.
8. IF `brushed-steel.webp`, `screw.webp`, `film.webp`, `light-cone.webp` or the Skeleton_Image fails to load, THEN THE Steel_Frame or Lightbox SHALL keep its layout and size unchanged, SHALL show a solid dark fallback fill in place of the missing image, and SHALL keep the document, the AI answer and the Control_Panel visible and operable.
9. WHEN the Toggle changes state, THE Lightbox SHALL switch between the X-ray view and the flat view within 300 ms without reloading the document or the AI answer and without changing the Lightbox size.

### Requirement 6: Document panel

**User Story:** As a viewer, I want to see the document the AI read, hanging on the film, so that I can compare what the AI read with the source.

#### Acceptance Criteria

1. THE Document_Panel SHALL show `paper.webp` as a strip held to the film by exactly two `clip.webp` clips, with one clip at each of the two top corners of the strip.
2. WHERE the document source is text, THE Document_Panel SHALL render the document text in a monospace font on top of the paper image, with every line of the text reachable by scrolling within the panel when the text is taller than the panel.
3. WHILE a rule is hovered or focused, THE Document_Panel SHALL show a field highlight and a source mark for each field linked to that rule, and SHALL show no highlight or source mark for fields not linked to that rule.
4. WHEN the hovered or focused rule changes or loses hover and focus, THE Document_Panel SHALL remove the highlights and source marks of the previous rule within 200 ms.
5. WHEN a field is overruled and its source location is known, THE Document_Panel SHALL draw a red scan line across the full width of the line at that source location.
6. IF a field is overruled and its source location is unknown, THEN THE Document_Panel SHALL draw no scan line and SHALL keep the document content unchanged.
7. WHERE the document source is an image, THE Document_Panel SHALL show the image on the paper area in place of the text.
8. THE Document_Panel SHALL render the document text with a Contrast_Ratio of at least 4.5:1 against the paper image.

### Requirement 7: Glass answer card and overrule stamp

**User Story:** As a viewer, I want the AI answer to look like fragile glass that the rules can break, so that "the rules overrule the AI" is visible in one glance.

#### Acceptance Criteria

1. THE Glass_Card SHALL show the AI answer fields on a frosted surface made with `backdrop-filter: blur`, using a blur radius between 4 px and 16 px.
2. IF the browser does not support `backdrop-filter`, THEN THE Glass_Card SHALL render the surface as an opaque panel colour and SHALL keep every AI answer field visible and readable.
3. WHEN at least one field is overruled, THE Glass_Card SHALL show `glass-cracks.webp` over its whole surface with `mix-blend-mode: screen`, and the cracks SHALL NOT intercept pointer events or hide any text.
4. WHEN at least one field is overruled, THE Glass_Card SHALL show the Overrule_Stamp on top of `stamp-frame.webp`, rotated by an angle whose absolute value is between 5 and 12 degrees, with the text "OVERRULED BY RULE", the rule label, and the rule version set as live text in code and not baked into the image.
5. IF more than one field is overruled, THEN THE Glass_Card SHALL show exactly one Overrule_Stamp, naming the rule label and version of the first overruled field in rule order.
6. IF no field is overruled, THEN THE Glass_Card SHALL show neither the cracks nor the Overrule_Stamp.
7. IF `glass-cracks.webp` or `stamp-frame.webp` fails to load, THEN THE Glass_Card SHALL still show the stamp text and the overruled-field rows, using a CSS-drawn border in place of the missing image.
8. THE Glass_Card SHALL render all text with a Contrast_Ratio of at least 4.5:1 against both the darkest and the lightest possible backdrop, including while the cracks and the Overrule_Stamp are shown.
9. THE Glass_Card SHALL keep exactly one DOM row per overruled field, each carrying the existing text alternative, so that the overruled state, field name, and rule label are available without colour or image.

### Requirement 8: Doctor panel

**User Story:** As a viewer, I want Dr. Bones in a phone-shaped chat, so that the explanation feels like a conversation with a person.

#### Acceptance Criteria

1. THE Doctor_Panel SHALL have rounded corners, a notch and a header containing a circular crop of `dr-bones.webp` and the text "Dr. Bones".
2. WHEN a chat message is added to the Doctor_Panel and Reduced_Motion is false, THE Doctor_Panel SHALL show it as a bubble and type its text out one character at a time.
3. WHILE Reduced_Motion is true, THE Doctor_Panel SHALL show each message's full text immediately, with no character-by-character typing.
4. THE Doctor_Panel SHALL take every message text from the existing chat builder and fixed templates, and SHALL NOT take any message text from an LLM.
5. THE Result_Footer SHALL show the result line as the result label, one space, then the amount formatted from integer cents as a currency value with two decimals, for example "PARTIALLY APPROVED $41.50".
6. THE Result_Footer SHALL show a progress bar whose filled share equals the approved amount in cents divided by the claimed amount in cents, from 0% to 100%.
7. IF the claimed amount is 0 cents, THEN THE Result_Footer SHALL show the progress bar at 0% filled and SHALL NOT show an error or an invalid value.
8. THE Result_Footer SHALL show the buttons "Replay decision" and "Human override".
9. WHEN the user activates "Replay decision", THE Xray_UI SHALL call `onReplay` exactly once; WHEN the user activates "Human override", THE Xray_UI SHALL call `onOverride` exactly once.
10. THE App SHALL remove "Overrule" from the toolbar and SHALL open its override dialog when the user activates the "Human override" button.
11. THE Doctor_Panel SHALL render all text with a Contrast_Ratio of at least 4.5:1 against the bubble colour and against the panel colour behind it.
12. WHILE a human override is in effect, THE Result_Footer SHALL show the effective result and the reviewer name, both taken from the existing `effective` prop.

### Requirement 9: Control panel

**User Story:** As a viewer, I want physical-looking controls, so that changing the rule version feels like turning a real dial.

#### Acceptance Criteria

1. THE Control_Panel SHALL use `brushed-steel.webp` as its background, SHALL show exactly four `screw.webp` screws, one at each corner of the panel, and SHALL overlap the lower left corner of the Steel_Frame.
2. THE Knob SHALL show `knob.webp` rotated to the angle of the selected version, and SHALL show the version labels "v1", "v2" and "v3" as text.
3. THE Knob SHALL expose `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext`, where `aria-valuenow` equals the index of the selected version and `aria-valuetext` equals the label of the selected version ("v1", "v2" or "v3").
4. WHEN the user presses ArrowLeft, ArrowDown, ArrowRight, ArrowUp, Home or End on the focused Knob, THE Knob SHALL call `onVersionChange` exactly once with the version returned by the existing `stepVersion` function for that key and the current version.
5. IF the key pressed on the focused Knob would leave the version unchanged (for example ArrowLeft on v1, or ArrowRight on v3), THEN THE Knob SHALL keep the selected version and SHALL NOT call `onVersionChange` with a version other than the one `stepVersion` returns.
6. THE Meter SHALL show `meter.webp` with an SVG needle and an SVG pivot, and SHALL expose `role="meter"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext`, where `aria-valuemin` is 0 and `aria-valuemax` is 100.
7. THE Meter SHALL set the needle angle with the existing `needleAngle` function, using the current AI read confidence as input.
8. IF no AI read confidence is available, THEN THE Meter SHALL show the needle at the angle `needleAngle` returns for 0, and SHALL set `aria-valuetext` to text stating that no confidence is available.
9. THE Toggle SHALL show `toggle.webp` and SHALL expose `role="switch"` with `aria-checked` set to "true" when on and "false" when off.
10. WHILE the Toggle is on, THE Toggle SHALL show the lever flipped with `scaleY(-1)`.
11. WHILE the Toggle is on, THE Lamp SHALL glow amber using `lamp.webp` with a CSS `drop-shadow` and a CSS `brightness` filter value greater than 1.
12. WHILE the Toggle is off, THE Lamp SHALL show the unlit image, with no `drop-shadow` and a `brightness` filter value of at most 1.
13. THE Control_Panel SHALL render its labels "RULE VERSION", "AI READ CONFIDENCE" and "X-RAY" with a Contrast_Ratio of at least 4.5:1 against the steel background.

### Requirement 10: Bone hotspots

**User Story:** As a viewer, I want each rule to glow at a bone of the photographic skeleton, so that the decision reads as an X-ray and not as a diagram.

#### Acceptance Criteria

1. THE Xray_UI SHALL hold an Anchor_Table with these entries as percent of the full Skeleton_Image, given as (x from left, y from top): skull (50, 9), ribs (57, 29), spine upper (50, 33), spine lower (50, 42), pelvis (56, 47), arm-right (69, 45), arm-left (31, 45).
2. THE Anchor_Table SHALL also define one anchor each for leg-left and leg-right, with both x and y between 0 and 100 percent of the full Skeleton_Image and inside the visible crop.
3. THE Xray_UI SHALL place exactly one Hotspot per bone of the Anatomy, centred on the anchor of the bone's region.
4. WHEN several bones share one region, THE Xray_UI SHALL place them at distinct positions that differ by at least 3 percent of the image width or at least 3 percent of the image height.
5. WHEN two bones share the spine region, THE Xray_UI SHALL place the first bone at the spine upper anchor and the second bone at the spine lower anchor.
6. THE Xray_UI SHALL keep the Anatomy API unchanged and SHALL use `ruleId`, `label` and `region` as the only inputs to the bone-to-anchor mapping.
7. WHEN the viewport size changes, THE Xray_UI SHALL keep each Hotspot at the same percent position of the Skeleton_Image, with a deviation of at most 0.1 percent.
8. WHILE the Hotspot_State is passed, THE Hotspot SHALL show a cyan glow ring and no check mark, splinters or fracture-burst image.
9. WHILE the Hotspot_State is applied-no-change, THE Hotspot SHALL show a cyan ring with one check mark.
10. WHILE the Hotspot_State is fractured, THE Hotspot SHALL show `fracture-burst.webp` with `mix-blend-mode: screen`, between 6 and 8 splinters from `splinters/`, and a red glow pulse.
11. WHILE the Hotspot_State is not-applicable, THE Hotspot SHALL show a dim ring with no glow, no check mark and no splinters.
12. WHILE Reduced_Motion is true, THE Hotspot SHALL show the fractured red glow as a static glow without pulse animation.
13. THE Hotspot SHALL be a focusable button whose accessible name contains the bone label, the rule version and the state text.
14. WHILE a Hotspot has keyboard focus, THE Hotspot SHALL show a visible focus ring with a Contrast_Ratio of at least 3 against its surroundings.
15. THE Xray_UI SHALL choose the splinter files and their directions with the existing deterministic hash, so that rendering the same Trace twice produces identical DOM output.
16. IF a splinter file or `fracture-burst.webp` fails to load, THEN THE Hotspot SHALL keep the red glow pulse and remain focusable with its accessible name unchanged.

### Requirement 11: Rule box with line to the bone

**User Story:** As a viewer, I want a box with a thin line to the bone when I hover, so that I see which rule belongs to which bone.

#### Acceptance Criteria

1. WHEN the pointer enters a Hotspot or the Hotspot receives focus, THE Xray_UI SHALL show the Rule_Box within 100 ms, containing the rule label, the rule version, the state text and all evidence rows of that rule.
2. WHEN the Rule_Box is shown, THE Xray_UI SHALL draw a straight line with a stroke width of at least 2 px and at most 3 px, in the cyan colour token, from the nearest edge of the Rule_Box to the centre of the Hotspot, and SHALL end the line with a filled dot on the Hotspot.
3. WHEN the pointer leaves the Hotspot or the Hotspot loses focus, THE Xray_UI SHALL hide the Rule_Box and the line within 100 ms.
4. WHEN the user presses Escape while a Rule_Box is shown, THE Xray_UI SHALL hide the Rule_Box and the line within 100 ms.
5. WHEN the Rule_Box is shown, THE Xray_UI SHALL place it fully inside the Lightbox bounds, on the side of the Hotspot (left or right) that has more free horizontal space, and on the other side if the first side cannot fit the full Rule_Box.
6. WHEN the Rule_Box is shown, THE Xray_UI SHALL set `aria-describedby` on the Hotspot to the id of the Rule_Box, and SHALL remove the attribute when the Rule_Box is hidden.
7. THE Rule_Box SHALL render all text with a Contrast_Ratio of at least 4.5:1 against its background.
8. WHEN a Rule_Box is shown, THE Xray_UI SHALL highlight the fields linked to that rule in the Document_Panel and the Glass_Card, and SHALL remove the highlight when the Rule_Box is hidden.
9. IF a rule has no evidence rows, THEN THE Xray_UI SHALL show the Rule_Box with the rule label, the rule version and the state text, and an empty-evidence indication in place of the rows.

### Requirement 12: Intro sequence

**User Story:** As a viewer, I want the film to power on when a case loads, so that the first three seconds feel like switching on a machine.

#### Acceptance Criteria

1. WHEN a case is loaded and Reduced_Motion is false, THE Xray_UI SHALL play the Intro in this order: film flicker on, light cone fade in, one scan line sweep from top to bottom over the Skeleton_Image, then each Hotspot lights up one at a time in the evaluation order of the Trace, with exactly one Hotspot lighting up per step and no Hotspot lit before the preceding Hotspot in that order.
2. WHEN the Intro starts, THE Xray_UI SHALL complete all Intro steps, including the Fracture_Moment of every fractured Hotspot, within 3500 ms of the Intro start, for a Trace of 1 to 20 Hotspots.
3. WHEN a case is loaded, THE Xray_UI SHALL play the Intro exactly once for that case.
4. WHEN a version change, a hover, a toggle change or a re-render occurs after the Intro for a loaded case has started, THE Xray_UI SHALL NOT restart or replay the Intro.
5. WHEN the Intro lights up a fractured Hotspot, THE Xray_UI SHALL play the Fracture_Moment for that Hotspot.
6. WHILE Reduced_Motion is true, THE Xray_UI SHALL skip the Intro and show the final still image, with every Hotspot in its final lit state and every fractured Hotspot in its final fractured state, on the first rendered frame after the case loads, with no flicker, scan line or Fracture_Moment animation.
7. THE App SHALL keep the existing intro state machine and its timing constants unchanged.
8. IF a new case is loaded while the Intro of the previous case is still playing, THEN THE Xray_UI SHALL stop the previous Intro and start the Intro for the new case from its first step.

### Requirement 13: Fracture moment

**User Story:** As a viewer, I want a fracture to feel like an impact, so that the moment the rules overrule the AI is memorable.

#### Acceptance Criteria

1. WHILE Reduced_Motion is false, WHEN a Hotspot becomes fractured, THE Xray_UI SHALL start the Fracture_Moment, which flashes the bone, scales in `fracture-burst.webp`, flies the splinters outwards while they fade to invisible, and shakes the Lightbox, and SHALL complete all of these effects within 1200 ms of the start.
2. WHILE the Lightbox shakes, THE Xray_UI SHALL keep the shake duration at or below 300 ms and the Lightbox displacement at or below 4 px from its resting position in every direction.
3. WHEN the shake ends, THE Xray_UI SHALL return the Lightbox to its resting position (0 px displacement).
4. WHILE Reduced_Motion is false, WHEN the Fracture_Moment starts, THE ECG line SHALL show a red spike within 100 ms of the start.
5. WHEN the Fracture_Moment ends, THE Xray_UI SHALL show the splinters at 0 opacity, and the burst, the red glow and the red ECG spike SHALL remain visible until the Hotspot is no longer fractured or the case is closed.
6. WHEN the user changes the rule version, THE Xray_UI SHALL play the Fracture_Moment once for each Hotspot that is fractured in the new version and was not fractured in the previous version, and SHALL NOT play it for a Hotspot that was fractured in both versions.
7. WHILE Reduced_Motion is true, THE Xray_UI SHALL show the burst, the splinters, the red glow and the red ECG spike at their final still positions with no animation, and the Lightbox SHALL stay at 0 px displacement.
8. IF `fracture-burst.webp` fails to load, THEN THE Xray_UI SHALL still show the red glow and the red ECG spike, SHALL still play the splinter and shake effects when Reduced_Motion is false, and SHALL NOT show a broken-image indicator.

### Requirement 14: Idle motion and control motion

**User Story:** As a viewer, I want the screen to stay alive after the intro, so that it never looks like a static picture.

#### Acceptance Criteria

1. WHILE the Toggle is on and Reduced_Motion is false, THE Skeleton_Image SHALL cycle its brightness continuously between a minimum factor of 0.95 and a maximum factor of 1.05, with each full cycle lasting 4 s (tolerance ±0.2 s).
2. WHILE the Toggle is on and Reduced_Motion is false, THE light cone SHALL flicker continuously with an opacity change of at most 0.1 (on a 0 to 1 opacity scale) between any two rendered states, and the opacity SHALL stay within the range 0 to 1.
3. WHILE the Toggle is on and Reduced_Motion is false, THE ECG line SHALL run continuously across the skeleton at a vertical position of 50 % of the Skeleton_Image height (tolerance ±1 %), moving from the left edge to the right edge and restarting at the left edge on each pass.
4. WHEN the selected version changes and Reduced_Motion is false, THE Knob SHALL rotate from the previous angle to the new angle with an easing curve over a duration between 200 ms and 600 ms, and SHALL end exactly at the new angle.
5. WHEN the Meter value changes and Reduced_Motion is false, THE needle SHALL move to the new angle and overshoot it by 1° to 8°, then settle exactly on the new angle within 800 ms.
6. WHEN the Toggle changes and Reduced_Motion is false, THE lever SHALL snap to the new position in at most 150 ms, and THE Lamp SHALL fade its glow to the new level over a duration between 150 ms and 500 ms.
7. WHILE Reduced_Motion is true, THE Xray_UI SHALL show the Knob, the Meter, the Toggle and the Lamp in their final state with a transition duration of 0 ms, and SHALL NOT run the brightness cycle, the light cone flicker or the ECG line movement.
8. WHILE the Toggle is off, THE Xray_UI SHALL NOT run the brightness cycle, the light cone flicker or the ECG line movement.

### Requirement 15: Reduced motion

**User Story:** As a viewer who is sensitive to motion, I want a calm still image, so that I can use the product without discomfort.

#### Acceptance Criteria

1. WHILE Reduced_Motion is true, THE Xray_UI SHALL run zero CSS animations, zero Web Animations, and zero CSS transitions with a duration greater than 0 ms.
2. WHILE Reduced_Motion is true, THE Xray_UI SHALL render the full text of each Dr. Bones chat message within 0 ms of the message being added, with no character-by-character typing.
3. THE Xray_UI SHALL declare every `@keyframes` rule only in files under `packages/xray-ui/src/styles/`.
4. WHILE the `prefers-reduced-motion: reduce` media query matches, THE Xray_UI SHALL disable every CSS animation and every CSS transition with a duration greater than 0 ms.
5. WHILE the `reducedMotion` prop is true, THE Xray_UI SHALL disable every CSS animation and every CSS transition with a duration greater than 0 ms, regardless of the media query result.
6. WHILE the `reducedMotion` prop is false and the `prefers-reduced-motion: reduce` media query matches, THE Xray_UI SHALL follow the prop and treat Reduced_Motion as false, as it does today.
7. WHEN the `reducedMotion` prop or the media query result changes, THE Xray_UI SHALL apply the new Reduced_Motion value within 100 ms, without a page reload.

### Requirement 16: Start screen

**User Story:** As a viewer, I want the start screen to be the same machine with three films on it, so that the first screen is already part of the show.

#### Acceptance Criteria

1. WHEN the App starts, THE App SHALL show the Header_Bar, the Steel_Frame and the Lightbox on the start screen.
2. WHEN the start screen is shown, THE start screen SHALL show exactly three Film_Sheets, one per sample case, each clipped to the Lightbox with `clip.webp`.
3. THE Film_Sheet SHALL show the case title (maximum 60 characters) and exactly one line of description (maximum 120 characters, no line breaks).
4. WHILE a sample case is not loaded, THE Film_Sheet SHALL NOT display the expected result of that case in visible text or in its accessible name or description.
5. THE Film_Sheet SHALL be a button whose accessible name is the case title and whose accessible description is its one-line description.
6. WHEN the user activates a Film_Sheet, THE App SHALL load the sample for that Film_Sheet, THE Film_Sheet SHALL slide into the viewer within 600 ms, and THE App SHALL start the Intro after the sample has loaded.
7. WHILE a sample is loading, THE start screen SHALL disable all three Film_Sheets and show the status text "Reading receipt".
8. IF loading a sample fails, THEN THE App SHALL show the existing error panel, remove the "Reading receipt" status text, re-enable all three Film_Sheets, and stay on the start screen without starting the Intro.
9. WHILE Reduced_Motion is true, THE Film_Sheet SHALL replace the slide with an immediate switch that has no animated transition (0 ms duration).
10. IF a Film_Sheet is activated while a sample is loading, THEN THE App SHALL ignore the activation and keep the current load unchanged.

### Requirement 17: Accessibility

**User Story:** As a keyboard or screen-reader user, I want every control to be reachable and named, so that the visual polish does not cost accessibility.

#### Acceptance Criteria

1. THE Xray_UI SHALL render the Knob with `role="slider"`, the Meter with `role="meter"` and the Toggle with `role="switch"`, each with a non-empty accessible name.
2. WHILE an element receives keyboard focus, THE Xray_UI SHALL display a visible focus ring with a contrast ratio of at least 3:1 against the adjacent background on that element, including Hotspots, Film_Sheets, buttons, Knob, Toggle and header actions.
3. THE Xray_UI SHALL mark every decorative image (frame, screws, light cone, film, cracks, burst, splinters, clips) with an empty alternative text or `aria-hidden="true"`.
4. THE Xray_UI SHALL keep the keyboard Tab order as: header actions, document, Hotspots, Doctor_Panel buttons, Control_Panel.
5. THE Xray_UI SHALL convey every Hotspot_State with a text label or an icon in addition to colour, so that each Hotspot_State is distinguishable when colour is not perceived.
6. WHEN a Rule_Box opens, THE Xray_UI SHALL keep keyboard focus on the element that had focus before the Rule_Box opened.
7. WHEN a Rule_Box opens, THE Xray_UI SHALL expose the Rule_Box content to assistive technology as an element associated with the Hotspot that opened it.
8. WHILE Reduced_Motion is true, THE Xray_UI SHALL keep every control from criteria 1 to 5 operable and nameable with all animations disabled.

### Requirement 18: Contrast tests

**User Story:** As a maintainer, I want contrast checks on every new text surface, so that the glass and image backgrounds cannot make text unreadable later.

#### Acceptance Criteria

1. THE Xray_UI contrast test SHALL contain exactly one foreground/background pair for each of the following 11 new text surfaces: Glass_Card text on glass, Glass_Card text on the lightest backdrop, Doctor_Panel bubble text, Doctor_Panel header text, Result_Footer text, Rule_Box text, Document_Panel text on paper, Control_Panel labels on steel, Header_Bar text, Film_Sheet text, and Overrule_Stamp text.
2. THE Xray_UI contrast test SHALL compute the glass backdrop pair against the worst case, defined as the lightest pixel colour of `film.webp` (the pixel with the highest relative luminance) alpha-blended with the glass tint at the glass tint's CSS alpha value.
3. THE Xray_UI contrast test SHALL require a Contrast_Ratio of at least 4.5:1 for each text pair and at least 3:1 for each focus ring pair.
4. IF a pair fails its required Contrast_Ratio, THEN THE Xray_UI contrast test SHALL fail and report the pair name, the computed ratio rounded to 2 decimal places, and the required ratio.
5. IF a token named in a pair is missing from `tokens.css`, THEN THE Xray_UI contrast test SHALL fail and report the name of the missing token.
6. THE Xray_UI contrast test SHALL keep the existing 18 token pairs unchanged, and SHALL replace the assertion of exactly 18 pairs by an assertion of at least 29 text pairs (18 existing and 11 new), plus the focus ring pairs.

### Requirement 19: Guard tests updated on purpose

**User Story:** As a maintainer, I want the guard tests to allow exactly what this feature needs and nothing more, so that the guards stay meaningful.

#### Acceptance Criteria

1. WHEN a guard test scans a file in Xray_UI that contains a CSS `url()` reference or an image import, THE Xray_UI guard tests SHALL pass for that reference only if the resolved target file is inside Asset_Dir, or is the one font file `@fontsource/cormorant-sc/files/cormorant-sc-latin-700-normal.woff2` (or the actual file name of the latin 700 normal woff2 file in that package).
2. IF a CSS `url()` reference or an image import in Xray_UI resolves to a file outside Asset_Dir other than the one font file allowed by criterion 1, or its target begins with `http://`, `https://` or `//`, THEN THE Xray_UI guard tests SHALL fail and report the offending file path and line number.
3. WHEN a guard test scans a file in Xray_UI that contains `@keyframes` or an `animation` or `animation-*` declaration, THE Xray_UI guard tests SHALL pass only if the file is located under `packages/xray-ui/src/styles/`.
4. IF a file under `packages/xray-ui/src/styles/` contains an `animation` or `transition` declaration that has no matching override to `none` or `0s` inside an `@media (prefers-reduced-motion: reduce)` block in the same file, THEN THE Xray_UI guard tests SHALL fail and report the file path and the selector without an override.
5. THE Xray_UI guard tests SHALL fail on any occurrence of `<canvas`, `getContext(`, `new Audio`, `AudioContext`, `fetch(`, `XMLHttpRequest`, `WebSocket`, an API-key pattern, `Math.random`, `Date.now` or `new Date(` in the same scope and with the same exemptions as before this feature.
6. THE App guard tests SHALL fail on any audio usage or authentication usage in the same scope and with the same exemptions as before this feature.
7. THE Xray_UI guard tests SHALL contain, in a comment directly above each guard changed by criteria 19.1 to 19.4, a statement of at least one sentence explaining why that guard changed.
8. THE `Lightbox.test.tsx` and `AnswerCard.styles.test.ts` files SHALL contain no standalone `url()` ban, and the `url()` rules in criteria 19.1 and 19.2 SHALL be the only `url()` checks applied to the files they previously covered.

### Requirement 20: Existing behaviour is preserved

**User Story:** As a maintainer, I want the polish to leave the product logic alone, so that nothing the auditor decides changes.

#### Acceptance Criteria

1. THE Core package SHALL remain byte-identical to its state before this feature, so that a diff of every file under the Core package between the commit before this feature and the commit after it reports 0 changed files.
2. THE App SHALL keep its pipeline, reducer, session store, replay store, override flow, export and recorded-mode behaviour unchanged, so that for each recorded sample and each rule version (v1, v2, v3) the resulting Trace, result, session state and exported file are equal to those produced before this feature.
3. THE Xray_UI SHALL keep its model functions (selectors, chat builder, ECG model, gauge, hash) behaviour-compatible, so that every existing test of these functions passes with 0 modifications to the test files.
4. WHEN the same Trace, Anatomy and props are rendered twice, THE Xray_UI SHALL produce identical DOM, so that the serialized markup of the second render equals the serialized markup of the first render character for character.
5. WHEN the App test suite and the Xray_UI test suite are run after this feature, THE test suites SHALL report 0 failing tests, with the sole exceptions of tests that assert the removed toolbar button, the removed `h1` text or the removed `url()` guard, and the 18-pair count in the contrast test, which SHALL be updated in the same commit as the change.
6. THE Xray_UI SHALL NOT call the network, an LLM or an audio API, so that a test which replaces network and audio entry points with failing stubs and renders every Xray_UI component records 0 calls to those stubs.
7. IF a test outside the named exceptions fails after this feature, THEN THE change SHALL be treated as a regression and SHALL NOT be committed until that test passes without modification to the test.

### Requirement 21: Visual regression check

**User Story:** As a maintainer, I want stored screenshots, so that later changes cannot silently break the look.

#### Acceptance Criteria

1. THE App SHALL include a Playwright test that opens the start screen at a 1440x900 viewport and compares a full-viewport screenshot against a Reference_Screenshot named for the start screen.
2. THE App SHALL include a Playwright test that loads the signature case at a 1440x900 viewport, waits until the Intro has ended or been skipped (the viewer reports its final state, within a maximum wait of 10 seconds), and compares a full-viewport screenshot against a Reference_Screenshot named for the signature case.
3. THE Playwright tests SHALL run with Reduced_Motion emulated as `reduce` and with recorded mode active, so that the output is deterministic and no API key is read or required.
4. THE Reference_Screenshots SHALL be committed to git, and THE Playwright tests SHALL be tracked in git alongside them.
5. THE Playwright tests SHALL assert that the page has no horizontal scrollbar and no vertical scrollbar at 1440x900 and at 1280x720, where "no scrollbar" means the document's scroll width equals its client width and its scroll height equals its client height.
6. IF a screenshot differs from its Reference_Screenshot by more than the configured tolerance (a maximum of 0.1% of pixels differing, with a per-pixel color threshold of 0.2), THEN THE Playwright test SHALL fail and attach the actual, expected and diff images to the test report.
7. IF no Reference_Screenshot exists for a compared screenshot, THEN THE Playwright test SHALL fail, and the missing reference SHALL NOT be created silently during a normal test run.
8. THE Playwright configuration SHALL start the app with `vite preview` on `127.0.0.1:4173` on the production build, and SHALL fail the run if the server is not reachable within 60 seconds.

### Requirement 22: Performance budget

**User Story:** As a viewer on a normal laptop, I want the screen to appear fast and move smoothly, so that the polish does not feel heavy.

#### Acceptance Criteria

1. THE Xray_UI SHALL animate only the CSS properties `transform`, `opacity` and `filter`, and SHALL NOT animate any other CSS property in any stylesheet or inline style.
2. THE Xray_UI SHALL bundle exactly 1 font file in woff2 format, at most 30,720 B (30 KB) in size, containing Cormorant SC weight 700 latin, and SHALL bundle no other font file.
3. WHEN the production build runs, THE build output SHALL contain every image from Asset_Dir, and the combined size of all files added by the Asset_Dir images SHALL be at most Asset_Budget, as verified by the asset-budget test of Requirement 1.
4. THE Xray_UI SHALL declare a width attribute and a height attribute, each a positive integer, on every `img` element it renders, so that images cause no layout shift while they load.
