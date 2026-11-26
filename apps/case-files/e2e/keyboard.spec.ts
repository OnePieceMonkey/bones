import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Flow f (R16.5, R21.2): start screen to verdict with the keyboard only. No mouse API is used
// (no click, hover, dblclick or page.mouse); navigation uses page.goto and page.keyboard.

interface Stop {
  label: string;
  outlineWidth: number;
  outlineStyle: string;
}

/** Role (or tag) and name of the focused element, plus its computed outline. */
async function focusedStop(page: Page): Promise<Stop> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (el === null || el === document.body) return { label: "body", outlineWidth: 0, outlineStyle: "none" };
    const cs = getComputedStyle(el);
    const role = el.getAttribute("role") ?? el.tagName.toLowerCase();
    const name = el.getAttribute("aria-label") ?? (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    return { label: `${role}:${name}`, outlineWidth: parseFloat(cs.outlineWidth), outlineStyle: cs.outlineStyle };
  });
}

/** Presses Tab from the document start until focus wraps back to the first stop. */
async function measureTabOrder(page: Page): Promise<Stop[]> {
  // Focus leaves the document after the last stop (activeElement is body). Walk to that point, then
  // record one full round from the document start to the next exit.
  for (let i = 0; i < 40 && (await focusedStop(page)).label !== "body"; i++) await page.keyboard.press("Tab");
  const stops: Stop[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const stop = await focusedStop(page);
    if (stop.label === "body") return stops;
    stops.push(stop);
  }
  throw new Error(`tab order did not end: ${JSON.stringify(stops.map((s) => s.label))}`);
}

/** Tabs until the focused stop matches; fails with everything seen. */
async function tabTo(page: Page, matcher: RegExp, max = 40): Promise<Stop> {
  const seen: string[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const stop = await focusedStop(page);
    seen.push(stop.label);
    if (matcher.test(stop.label)) return stop;
  }
  throw new Error(`no tab stop matched ${matcher}; saw ${JSON.stringify(seen)}`);
}

function expectRing(stop: Stop): void {
  expect(stop.outlineStyle, `${stop.label}: outline style`).toBe("solid");
  expect(stop.outlineWidth, `${stop.label}: outline width`).toBeGreaterThanOrEqual(3);
}

/**
 * Collapses the measured stops into names, in order; consecutive stops of one kind become one name.
 * Every stop must be known, so a new tab stop makes the spec fail.
 */
function named(stops: readonly Stop[]): string[] {
  const table: Array<[RegExp, string]> = [
    [/^button:(Download trace|Load another case)/, "header actions"],
    [/^region:Document content/, "document content region"],
    [/^div:AI answer/, "AI answer card"],
    [/^radio:/, "name plates"],
    [/^button:.*, rule .*, (fractured|passed|not applicable)$/, "bone buttons"],
    [/^slider:RULE VERSION/, "knob"],
    [/^switch:X-RAY/, "X-RAY"],
    [/^button:Accuse$/, "Accuse"],
    [/^button:Replay$/, "Replay"],
    [/^button:New case$/, "New case"],
    [/^log:/, "chat log"],
    [/^button:Replay decision/, "Replay decision"],
    [/^button:Human override/, "Human override"],
  ];
  const out: string[] = [];
  for (const s of stops) {
    const hit = table.find(([re]) => re.test(s.label));
    if (hit === undefined) throw new Error(`unknown tab stop: ${s.label}`);
    if (out[out.length - 1] !== hit[1]) out.push(hit[1]);
  }
  return out;
}

/**
 * The documented tab order (R16.5). The named interactive parts come in the order of the requirement.
 * The extra stops are the document scroller, the glass card and chat log scrollers (keyboard-focusable
 * scroll containers), the bone buttons (the skeleton's tooltips, X-RAY on) and the doctor's own
 * "Replay decision" button.
 */
const CASE_ORDER = [
  "header actions",
  "document content region",
  "AI answer card",
  "name plates",
  "bone buttons",
  "knob",
  "X-RAY",
  "Accuse",
  "Replay",
  "chat log",
  "Replay decision",
  "Human override",
];
const VERDICT_ORDER = CASE_ORDER.flatMap((n) => (n === "Accuse" ? [] : n === "Replay" ? [n, "New case"] : [n]));

test("keyboard only: start screen to verdict, ring on every stop", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  // Start screen: Tab to a sheet and open it with Enter.
  const sheet = await tabTo(page, /Midnight Greenhou/i);
  expectRing(sheet);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("switch", { name: "X-RAY" })).toHaveAttribute("aria-checked", "false");

  // Plates: one tab stop; arrow keys move and select inside the group.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const plate = await tabTo(page, /^radio:/);
  expectRing(plate);
  const checked = page.locator('[role="radio"][aria-checked="true"]');
  await expect(checked).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(checked).toHaveCount(1);
  const first = await checked.textContent();
  await page.keyboard.press("ArrowRight");
  expect(await checked.textContent()).not.toBe(first);
  for (let i = 0; i < 6 && !/widow/i.test((await checked.textContent()) ?? ""); i++) await page.keyboard.press("ArrowRight");
  await expect(checked).toContainText(/widow/i);

  // Knob: arrow keys change the version, the status note shows the replay.
  const knob = await tabTo(page, /^slider:RULE VERSION/);
  expectRing(knob);
  const slider = page.getByRole("slider", { name: "RULE VERSION" });
  await expect(slider).toHaveAttribute("aria-valuetext", "v1");
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuetext", "v2");
  await expect(page.getByText("Replayed with v2. Original: v1.")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(slider).toHaveAttribute("aria-valuetext", "v1");

  // X-RAY switch with Space.
  const xray = await tabTo(page, /^switch:X-RAY/);
  expectRing(xray);
  await page.keyboard.press("Space");
  await expect(page.getByRole("switch", { name: "X-RAY" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".xr-ensemble-stage")).toBeVisible();

  // Tab order on the case screen (R16.5), measured with a suspect selected and X-RAY on.
  const caseStops = await measureTabOrder(page);
  for (const s of caseStops) expectRing(s);
  expect(named(caseStops)).toEqual(CASE_ORDER);

  // Accuse with Enter.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const accuse = await tabTo(page, /^button:Accuse/);
  expectRing(accuse);
  await page.keyboard.press("Enter");
  await expect(page.locator(".case-banner")).toContainText("CASE CLOSED");

  // Verdict view: every stop has a ring, Replay and Human override are reachable, the dialog opens by key.
  const verdictStops = await measureTabOrder(page);
  for (const s of verdictStops) expectRing(s);
  expect(named(verdictStops)).toEqual(VERDICT_ORDER);

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await tabTo(page, /^button:Replay$/);
  await page.keyboard.press("Enter");
  await tabTo(page, /^button:Human override/);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Overrule verdict" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Human override" })).toBeFocused();
});
