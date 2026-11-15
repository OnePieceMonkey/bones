# @bones/xray-ui

React components that render a decision `Trace` from `@bones/core` as a 1950s-radiology X-ray. Each mapped rule is a bone. A rule that changed the decision is a fractured bone. The library treats every rule as opaque. The host app supplies the wording through an `Anatomy`.

## Installation (pnpm workspace)

The package is part of the workspace and is not published. In an app under `apps/`, add it as a workspace dependency:

```json
{
  "dependencies": {
    "@bones/xray-ui": "workspace:*",
    "@bones/core": "workspace:*"
  }
}
```

Then run `pnpm install` at the repository root. `react` and `react-dom` (^18.3.1) are peer dependencies. The package exports TypeScript source (`./src/index.ts`), so the consuming app needs a bundler such as Vite. Importing the package also loads its stylesheets.

```tsx
import { XrayView } from "@bones/xray-ui";
```

## The Anatomy contract

An `Anatomy` tells the library which rules get a bone, where each bone sits, and how to label and format fields.

```ts
type Region =
  | "skull" | "spine" | "ribs" | "arm-left"
  | "arm-right" | "pelvis" | "leg-left" | "leg-right";

interface Anatomy {
  bones: { ruleId: string; label: string; region: Region }[];
  fieldLabels: Record<string, string>;
  formatValue?: (path: string, value: unknown) => string;
}
```

- `bones`: one entry per rule that should be drawn. Rules in the trace without an entry get no bone. Entries without an outcome are shown as "not applicable". Bones in the same region are placed in array order.
- `fieldLabels`: label for a field path. A missing path falls back to the path itself.
- `formatValue`: optional. Without it, strings are shown as is, numbers via `String`, and other values via `JSON.stringify`. The result amount is formatted with `formatValue("amountCents", trace.amountCents)`.

Example:

```tsx
import { XrayView, type Anatomy } from "@bones/xray-ui";

const anatomy: Anatomy = {
  bones: [
    { ruleId: "rule-a", label: "Rule A", region: "ribs" },
    { ruleId: "rule-b", label: "Rule B", region: "pelvis" },
  ],
  fieldLabels: { total: "Total" },
  formatValue: (path, value) =>
    path === "amountCents" ? `$${(Number(value) / 100).toFixed(2)}` : String(value),
};

<XrayView
  trace={trace}
  anatomy={anatomy}
  source={{ kind: "text", text: "..." }}
  versions={["v1", "v2", "v3"]}
  version={version}
  onVersionChange={setVersion}
/>;
```

A bone is fractured only when its rule matched and changed the decision: a blocking effect, or a capping or deducting effect whose `amountAfterCents` is lower than `amountBeforeCents`. A matched capping or deducting rule that changed nothing is shown as passed with the text "applied, no change".

## Showing a human override: the `effective` prop

`XrayView` and `ResultPlate` accept an optional `effective` prop:

```ts
effective?: { result: DecisionResult; reviewerName: string };
```

`DecisionResult` comes from `@bones/core`. Without `effective`, the plate shows the rule result as before. With it, `ResultPlate`:

- shows the label and icon of `effective.result` instead of the rule result,
- adds the line "overruled by <reviewerName>",
- adds the line "Rules decided: <label>", with the label of `trace.result`,
- labels the amount "Amount by rules".

Amount rule: an override carries a result, never an amount. The only amount on the plate is the rule amount, `trace.amountCents`, formatted with `formatValue`. The plate does not recompute or replace it.

`trace` stays unchanged and keeps describing the rule decision. In `XrayView`, only `ResultPlate` receives `effective`. `Skeleton`, `EcgLine`, `AnswerCard`, `DrBonesChat` and `FilmClip` all get the same `trace`, so fractures, the heartbeat line and the "OVERRULED BY RULE" stamp look the same with or without an override. The `title` prop still feeds the title plate.

```tsx
<XrayView
  trace={trace}
  anatomy={anatomy}
  source={source}
  versions={versions}
  version={version}
  onVersionChange={setVersion}
  effective={{ result: "approved", reviewerName: "A. Meyer" }}
/>
```

## Exported components

- `XrayView`: composition of all parts in the reference layout.
- `Lightbox`: dark viewer with a brushed-metal frame and title plate.
- `Skeleton`: SVG skeleton with the 8 regions and one bone per anatomy entry.
- `BoneButton`, `BoneGlyph`: a single bone and its glyph.
- `Tooltip`: rule id, version, state and evidence for a bone.
- `EcgLine`: heartbeat line with one red spike per fracture, flat on rejection.
- `FilmClip`: the source input as film held by two clips, with source boxes.
- `AnswerCard`: proposed fields with confidence, crack overlay and "OVERRULED BY RULE" stamp.
- `DrBonesChat`: chat panel that explains the decision from the trace.
- `ControlStrip`: holds the three controls below.
- `KnobControl`: RULE VERSION rotary knob.
- `GaugeControl`: AI READ CONFIDENCE needle gauge.
- `ToggleSwitch`: X-RAY switch with lamp.
- `ResultPlate`: result label, icon and amount. Takes an optional `effective` prop (see above).

Hooks: `useReducedMotion`, `useTypewriter`, `HoveredRuleProvider`, `useHoveredRule`.

Pure helpers are also exported: the selectors (`isFracture`, `selectBones`, `evidenceRows`, `fieldViews`, `countPassed`, and others), `buildChatMessages`, `buildGaugeModel`, `buildEcgModel`, `defaultFormat`, `safeFormat` and `resultLabel`. See `src/index.ts` for the full list.

Every component renders on its own, without `XrayView`. Rendering is deterministic: the same trace, anatomy and props produce identical HTML. Visual variation (splinters, cracks) comes from a hash of `ruleId` or `decisionId`.

## Reduced motion

Reduced-motion mode is active when the `prefers-reduced-motion: reduce` media query matches. Components that accept a `reducedMotion` prop use that value instead of the media query. In this mode:

- No element carries an `anim-` class, so there are no pulse rings, shakes or ECG scrolling.
- `DrBonesChat` shows each message in full at once, with no typing phase.
- Every bone state is still shown by colour, icon and text.

`useReducedMotion` is exported for host apps.

## Accessibility notes

- Every control works with the keyboard. The knob uses the arrow keys, Home and End. The switch uses Space and Enter. Bones are focusable and Escape closes the tooltip.
- Every focusable element shows a focus ring.
- State, result and overruled markers always have text or an icon in addition to colour.
- Bones have an `aria-label` with the label, rule version and state in words. The chat log uses `aria-live="polite"`. The ECG graphic is `aria-hidden` and has a visually hidden summary. The switch uses `role="switch"` with `aria-checked`.
- Text and background colour pairs from the design tokens meet 4.5:1 for normal text and 3:1 for large text.

Automated tests cover token contrast ratios and ARIA roles only. Full WCAG validation needs manual testing with assistive technologies such as screen readers and keyboard-only navigation.

## Guarantees: no LLM, no network, no rule evaluation

This package:

- calls no LLM and holds no API key or LLM client,
- makes no network call (`fetch`, `XMLHttpRequest`, `WebSocket`),
- evaluates no rules and replays no decisions,
- ships no audio and exposes no sound API.

Dr. Bones' text comes from fixed templates, the rule's `renderedMessage` and the trace. When the knob changes, the component only calls `onVersionChange`. The host app replays the decision and passes the new trace.

## Run the demo

```sh
pnpm --filter @bones/xray-ui dev
```

The demo (`demo/`) evaluates the recorded signature scenario from `@bones/core` test fixtures with the rule sets v1, v2 and v3, and renders an `XrayView`. Turning the knob re-evaluates with the chosen rule set and passes the new trace.

Other scripts: `pnpm --filter @bones/xray-ui test` and `pnpm --filter @bones/xray-ui typecheck`.
