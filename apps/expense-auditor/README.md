# Expense Auditor

A receipt goes in. The AI reads it. Company expense rules decide: approved, partially approved or rejected. Every decision is stored as a trace you can replay, download and overrule.

**The demo works fully offline.** In Fixture (recorded) mode, the default, the app loads stored AI readings from the repository. It needs no API key and no network. Live mode (reading your own receipt photo) needs your own `ANTHROPIC_API_KEY`, set on the server only. It is never put in the client. Locally it goes in `.env.local`. On Vercel it goes in the project environment variables.

This app is built on the Bones skeleton (`packages/core` and `packages/xray-ui`). It never imports from `apps/case-files`.

## Why the LLM never decides

An AI model can read a messy receipt photo well. It cannot be audited when it also makes the decision: the same receipt can get a different answer tomorrow, and nobody can say which rule was applied.

So the work is split:

1. The AI only proposes structured fields: merchant, date, line items, total. It also reports how sure it is and where on the receipt it found each value.
2. The proposal must match a typed schema. If it does not, it is rejected and no decision is made.
3. Versioned, declarative rules decide. The same fields and the same rule version always give the same result.
4. Every decision is saved as a trace: the proposed fields, the validated fields, every rule outcome with its evidence, and the result.
5. A person can overrule a decision. The override is stored next to the trace. The original trace is never edited.

The explanations in the Dr. Bones chat come from rule message templates and the trace. No AI model writes them.

## The five Bones parts in this app

| Part | Where it lives in this app |
| --- | --- |
| Extraction | `src/extraction/RecordedSampleAdapter.ts` (offline, reads `recorded/*.json`), `src/extraction/HttpExtractionAdapter.ts` (live, calls `/api/extract`), and the Zod schema in `src/pipeline/schema.ts`. The server function is `api/extract.ts`. |
| Rules | `rules/expense-auditor/` at the repository root: single rules in `rules/`, rule sets `expense-v1`, `expense-v2`, `expense-v3` in `rule-sets/`. |
| Trace | The frozen trace created by `@bones/core`, and the file you get from **Download trace** in the header. |
| Human override | The **Human override** button in the Dr. Bones panel. It opens a dialog (titled "Overrule decision") and stores a separate override record. |
| X-ray UI | `XrayView` from `@bones/xray-ui`. Each bone is one rule. A failed rule is a fractured bone. |

## What you see

- **X-ray lightbox.** A dark screen with a cyan glow inside a brushed-metal frame. The receipt hangs as an X-ray film with clips. A heartbeat line runs across the skeleton and spikes red at a fracture.
- **Start screen.** Receipts are shown as film sheets. Pick one to load it. In Live mode, a photo upload form also appears above the sheets.
- **Decision view.** The skeleton shows one bone per rule. The AI answer card shows what the AI read. When a rule overrules a field, the card cracks like glass and shows the stamp "OVERRULED BY RULE".
- **Dr. Bones panel.** A chat that types out the explanation. It has the **Human override** button.
- **Header.** **Download trace** saves the decision as a JSON file. **Load another receipt** returns to the start screen. The X-RAY ON/OFF pill is in the middle.
- **Control strip.** A RULE VERSION knob (v1, v2, v3) replays the decision with that rule set version. An AI READ CONFIDENCE needle meter shows how sure the AI was. An X-RAY switch turns the overlay on and off.

## Try it

You need Node.js and pnpm.

1. From the repository root, install: `pnpm install`
2. Start the app: `pnpm --filter @bones/expense-auditor dev` (or run `pnpm dev` inside `apps/expense-auditor`).
3. Open the printed local address and click the film sheet **Signature case**. You should see:
   - the amount "$41.50"
   - two fractured bones in the skeleton
   - the AI answer card cracked
   - the stamp "OVERRULED BY RULE"
4. Turn the RULE VERSION knob to v2 and v3 to replay the same receipt with other rule sets. Click **Download trace** to save the trace. Click **Human override** to overrule the decision.

The other two sheets are "Clean meal" and "Outside the trip window".

Scripts (run inside `apps/expense-auditor`, or use `pnpm --filter @bones/expense-auditor <script>`):

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server. It also serves `/api/extract` for local live mode. |
| `pnpm build` | Production build into `dist/`. |
| `pnpm build:check` | Type check, then build. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm test` | Unit, property-based and guard tests (Vitest, fast-check). |
| `pnpm test:e2e` | Builds, then runs the Playwright tests. |
| `pnpm preview` | Serves the built app. |

From the repository root, `pnpm e2e` runs the same `test:e2e` for this app.

## Tests

`pnpm test` runs, among others:

- unit and property-based tests for the pipeline, state, formatting and the server function (against fakes);
- a config smoke test for `vercel.json`, `.env.example` and `package.json`;
- guards: no secrets in `src`, no currency code as a word, no LLM in the chat, no imports from the other app, contrast, app hygiene.

Nothing in the tests calls the real AI provider. Live extraction is tested only with fakes: the handler against a fake client, the provider client against a fake `fetch`, the browser adapter against a mocked `fetch`.

### Visual regression tests

Playwright takes screenshots of the start screen and the signature case and compares them with reference images in `e2e/__screenshots__/`. Other e2e tests check layout at several viewport sizes, that no page scrollbar appears, and that the page only talks to its own origin (plus the status check on `/api/`).

One-time setup, then run:

```
pnpm exec playwright install chromium
pnpm test:e2e
```

Only Chromium is tested. Firefox and WebKit are not. The viewport is 1440x900, with reduced motion and a dark color scheme. Small differences are tolerated (about 0.1% of pixels). A missing reference image fails the run.

If a visual change is intended, update the references on purpose and review the changed images before you commit them:

```
pnpm build
pnpm exec playwright test --update-snapshots
```

The reference file names do not include the operating system. Font rendering can differ between machines, so references made on one OS may fail on another.

## Live mode locally

1. Copy `.env.example` to `.env.local` in `apps/expense-auditor`. `.env.local` is ignored by git. Never commit it.
2. Set `LIVE_EXTRACTION=on`, choose a provider with `LLM_PROVIDER` and put the key of that provider in the file. `EXTRACTION_MODEL` is the model id for that provider (see "Choosing a provider" below).
3. Run `pnpm dev`. The dev server loads these variables on the server side only and serves `/api/extract`.
4. Open the app. The photo upload form appears when the server reports that live reading is on.

Do not prefix these variables with `VITE_`. Variables with that prefix are sent to the browser.

The dev middleware in `vite.config.ts` that serves `/api/extract` has no automated test. It is a development convenience. Production uses the Vercel runtime.

## Live mode on Vercel

1. Create a Vercel project from this repository. Set **Root Directory** to `apps/expense-auditor`.
2. In the Root Directory settings, turn on **Include source files outside of the Root Directory in the Build Step**. The build needs `rules/` and `packages/*`.
3. Install command: `pnpm install --frozen-lockfile`. Build command: `pnpm build`. Output directory: `dist`. These are already in `vercel.json`.
4. In the project environment variables set `LLM_PROVIDER`, the key of that provider (`ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY`), `EXTRACTION_MODEL` and `LIVE_EXTRACTION=on`.
5. After the first deploy, call `GET /api/extract`. It must answer `{"live":true}`. With `LIVE_EXTRACTION` off, or with a missing key or model, it answers `{"live":false}`.

The first real deploy and the first real provider call are manual steps. Nothing in this repository has made them. These points are not verified yet and need a check on the first deploy: the working directory Vercel uses for the install command, which pnpm major version Vercel picks, whether the Content Security Policy in `vercel.json` blocks any asset, and whether your plan offers Firewall rate-limit rules.

### Choosing a provider

Two providers are supported. Set `LLM_PROVIDER` to pick one. All of these are server-side variables.

| `LLM_PROVIDER` | Key variable | `EXTRACTION_MODEL` example |
| --- | --- | --- |
| `anthropic` (default when unset) | `ANTHROPIC_API_KEY` | `claude-haiku-5-5` |
| `openrouter` | `OPENROUTER_API_KEY` | `anthropic/claude-haiku-5.5` |

Live reading is on only when `LIVE_EXTRACTION=on`, the model is set and the key of the selected provider is set. The key of the other provider is ignored. An unknown `LLM_PROVIDER` value counts as a misconfiguration: `GET /api/extract` answers `{"live":false}` and `POST` answers 403. Both keys stay on the server and are never put in the client.

With `LLM_PROVIDER=openrouter` the function calls the OpenRouter chat completions API with the same `max_tokens` of 16000, `reasoning` set to low effort with the reasoning text excluded, and `provider.require_parameters` so the JSON schema is always honoured. Any failure gives the same generic error and no provider text, and there are no retries.

### Provider settings

The text below describes the Anthropic default.

The function calls the Anthropic Messages API with `max_tokens` 16000 and `output_config.effort` set to `"low"`. It sends no `thinking` field. The model thinks adaptively, and those thinking tokens count against `max_tokens`. A large cap with low effort leaves room for the JSON answer, so it is not cut off. If the answer is cut off or the model refuses, the function returns a generic failure and shows no provider text. There are no retries. The request shape is pinned by a test against a fake `fetch`.

## Security notes

- The API key lives only in the server environment. The client code never reads it, and the browser only talks to `/api/extract`.
- `LIVE_EXTRACTION` is a kill switch. Anything other than `on`, or a missing key or model, turns live reading off and `POST /api/extract` answers 403.
- Requests with a foreign `Origin` header are refused.
- Images are limited to 3 MiB. The browser shrinks photos before sending. The server also checks the size and the file signature.
- There is a per-IP rate limit of 10 requests per 10 minutes. It is best effort: the counter lives in memory of one function instance, and each instance and each restart has its own. Do not rely on it.
- Set a spend limit at the AI provider. If your plan supports it, add a platform rate-limit rule (for example Vercel Firewall).
- `vercel.json` sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and a Content Security Policy. The config smoke test checks the build settings in `vercel.json`. The headers are served and enforced only on Vercel. They do not apply to `pnpm dev` or `pnpm preview`, and they have not been tested in a deployed browser.
- A guard test (`tests/guards/no-secrets.node.test.ts`) builds the app with a canary key set in the environment. It fails if the Anthropic or OpenRouter canary key, `x-api-key`, `anthropic-version`, `api.anthropic.com`, `openrouter.ai`, `Bearer`, the variable names (including `OPENROUTER_API_KEY` and `LLM_PROVIDER`) or key-like strings appear anywhere in the built `dist/`, or in `src`. It also fails on source maps. It does not scan `api/` (server code) or this README.
- The server logs only status, a short code and duration. Not the image, not the key, not the IP address.

## Manual check before a release

**This is a manual step. No automated test replaces it.** A person has to do it with their own eyes and hands. The e2e and unit tests cover layout, timing logic and guards, but they cannot judge how the screen looks, feels or sounds. None of the items below is ticked: copy the list into your release notes or an issue and tick it there as you go.

Start with the dev server: `pnpm --filter @bones/expense-auditor dev`. Later, run `pnpm --filter @bones/expense-auditor build` and then `pnpm --filter @bones/expense-auditor preview`, and repeat the items marked "(also in preview)". Keep the browser console open the whole time.

### First 10 seconds

- [ ] Open the start screen. Receipts appear as film sheets. A photo upload form shows only in Live mode.
- [ ] Click **Signature case**. The plain receipt shows first, with no skeleton.
- [ ] The film flickers once, then a light cone falls on the film.
- [ ] A scan line sweeps over the film.
- [ ] The X-RAY overlay switches on after about 0.6 s, and the bones light up one by one.
- [ ] Failed rules show fractured bones: red glow, a burst of splinters, a short screen shake and a pulse ring.
- [ ] The ECG line across the skeleton spikes red at each fracture.
- [ ] The AI answer card cracks like glass and the stamp "OVERRULED BY RULE" lands on it.
- [ ] Dr. Bones types out the explanation in the chat panel.
- [ ] No console errors or warnings appear during the whole sequence (also in preview).

### Samples, versions and controls

- [ ] Load all three samples: Signature case, Clean meal, Outside the trip window. Each result matches what the sample promises (Signature case: two fractured bones, stamp shown; Clean meal: approved).
- [ ] Turn the RULE VERSION knob to v1, v2 and v3 on each sample. The decision replays with that rule set version and the skeleton, card and chat update.
- [ ] The AI READ CONFIDENCE needle sits on the right value. Its alignment with the scale was never checked visually, so look closely at the needle pivot and the scale marks.
- [ ] The X-RAY switch turns the overlay off and on again. The plain receipt is shown when it is off.
- [ ] Hover a rule box, then focus it with the keyboard. A line connects the box to its bone.
- [ ] The leg bones of the skeleton sit where they belong. The leg anchor points (44,58) and (57,58) were never checked visually. Look at where the leg bones attach and where lines to them end.
- [ ] Click **Human override**. The dialog "Overrule decision" opens, a result can be chosen and saved, and the override shows next to the original decision. The original trace is unchanged.
- [ ] **Download trace** in the header saves a JSON file. Open it and check that it holds the decision and any override.
- [ ] **Load another receipt** in the header returns to the start screen.

### Keyboard only

Put the mouse away for this block.

- [ ] Tab reaches every control in a sensible order, and the focus ring is always visible.
- [ ] The RULE VERSION knob changes version with the keyboard.
- [ ] The X-RAY switch toggles with the keyboard.
- [ ] The override dialog opens, takes focus, can be completed and closed with the keyboard, and returns focus to the button.
- [ ] **Download trace** and **Load another receipt** work with the keyboard.

### Reduced motion

- [ ] Turn on "reduce motion" in the operating system settings and reload. The signature case shows a calm still image: no flicker, no light cone movement, no scan line, no shake, no moving ECG, no burst. The result (fractures, cracked card, stamp) is still readable.
- [ ] Turn the setting off again and confirm the full intro returns.
- [ ] Sound is off by default and stays off.

### Layout and look

- [ ] At 1440x900, the start screen and the decision view each fit on one screen with no page scroll.
- [ ] At 1280x720, the same: no page scroll and nothing cut off.
- [ ] Compare the screen with `design/mockups/bones-7-retro-b.png`: brushed-metal frame, dark lightbox with cyan glow, control strip at the bottom left, film clips, red fracture glow. Note every difference you think is wrong.
- [ ] Text is readable on every surface (lightbox, cards, chat, control strip).

### Dev server and live mode

- [ ] The dev middleware has never been run by hand. With `pnpm dev`, open `/api/extract` in the browser (a GET). It answers with a small JSON object that says whether live reading is on.
- [ ] With live reading off (the default), the photo upload form is not shown.
- [ ] With live reading on and a real key in `.env.local` (see "Live mode locally"), upload a real receipt photo. A decision appears, the AI answer card shows what was read, and the rules decide. Check that the key does not appear in the network tab or in the page source.
- [ ] Upload something that is not a receipt, or an image that is too large. The error panel shows a calm, generic message with no provider text.

### Vercel preview deploy

- [ ] Deploy a Vercel preview from a branch. `vite preview` does not apply the headers from `vercel.json`, so only the deployed preview can show them.
- [ ] In the deployed preview, the console shows no Content Security Policy violations, and fonts, styles, images and the canvas layer all load.
- [ ] In the network tab, only the app's own origin is contacted.
- [ ] `GET /api/extract` on the preview answers as expected. With live reading on and a real key set in the Vercel environment variables, a real photo is read.
- [ ] The response headers include `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Content-Security-Policy`.

## Known limitations

- **No persistence.** State lives in memory. A reload discards the trace, the replays and the overrides. **Download trace** is the only record.
- **An override carries a result, not an amount.** The app shows the overruling result next to the amount the rules computed. It does not invent a new amount.
- **Overrides belong to one rule version.** An override made at v3 is not shown at v1 or v2.
- **A replay is a new trace.** After **Load another receipt**, the link to the original is gone.
- **Trip window.** The samples use a fixed window, 2024-03-10 to 2024-03-20. In Live mode you enter it yourself.
- **Live photos get no marks.** The prompt does not ask for coordinates, so no source marks are drawn on photos. Samples (text receipts) do show them.
- **Hash of the photo.** In Live mode the input hash covers the shrunk image that was sent to the AI, not your original file.
- **Stamp text.** For the signature case, both bones show as fractured, but the stamp names only "Line-item match". The alcohol bone checks derived values, not a field the AI proposed.
- **Rate limit is best effort** (see Security notes).
- **Chromium only** in end-to-end tests.
- **Currency.** Amounts are shown in "$" with no conversion. The limits named in meal messages are literal text in the rule files.
- **Bundle size.** One JavaScript chunk, no code splitting. The size is not measured here. `pnpm build` prints it.
- **API drift.** The Anthropic API version, the model id and the structured output format are constants or environment variables. If the provider changes them, it is a one-line edit.
