import { expect, test } from "@playwright/test";

// Flow g (R18.5, R21.2): the app talks to its own origin only, loads its own files only and never asks for a live case.
const ORIGIN = "http://127.0.0.1:5202";
// The app's own files: the page and the built assets (script, style, images, fonts).
const OWN_FILE = /^\/(index\.html|assets\/[^/]+\.(js|css|svg|webp|woff2?|ttf|otf))?$/;
const FONT_HOSTS = /fonts\.(googleapis|gstatic)\.com|use\.typekit\.net|fonts\.bunny\.net/;

test("no request leaves the app origin; live is off and the note shows", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  // Nothing answers a live status request: if the app asked, the request is recorded and aborted.
  await page.route("**/api/**", (route) => route.abort());

  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByText("Live mode is off on this server. Pick a recorded case.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Write case" })).toBeDisabled();

  // A full play: open, select, X-RAY, version change, accuse, back to the start.
  await page.getByRole("button", { name: /midnight greenhouse/i }).click();
  await page.getByRole("radio", { name: "the widow" }).click();
  await page.getByRole("switch", { name: "X-RAY" }).click();
  await page.getByRole("button", { name: "Accuse", exact: true }).click();
  await expect(page.locator(".case-banner")).toContainText("CASE CLOSED");
  await page.getByRole("button", { name: "Load another case" }).click();
  await expect(page.getByRole("button", { name: /midnight greenhouse/i })).toBeVisible();

  expect(requests.length).toBeGreaterThan(0);
  const external = requests.filter((u) => {
    const url = new URL(u);
    return url.protocol !== "data:" && url.protocol !== "blob:" && url.origin !== ORIGIN;
  });
  expect(external, "requests that leave 127.0.0.1:5202").toEqual([]);
  expect(requests.filter((u) => FONT_HOSTS.test(u))).toEqual([]);
  expect(requests.filter((u) => new URL(u).pathname.startsWith("/api/"))).toEqual([]);
  const foreignFiles = requests
    .filter((u) => new URL(u).origin === ORIGIN)
    .map((u) => new URL(u).pathname)
    .filter((p) => !OWN_FILE.test(p));
  expect(foreignFiles, "requests that are not the app's own files").toEqual([]);
});
