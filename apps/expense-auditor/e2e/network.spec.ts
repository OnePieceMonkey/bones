import { expect, test } from "@playwright/test";

const ORIGIN = "127.0.0.1:4173";
const FONT_HOSTS = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net|fontawesome\.com|cdn\.jsdelivr\.net|unpkg\.com)$/i;

test("all requests stay on 127.0.0.1:4173, only the status GET to /api/, no font host", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  const apiRequests: { method: string; path: string }[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (/\/api\//.test(path)) apiRequests.push({ method: request.method(), path });
  });

  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /signature case/i }).click();
  await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
  await page.waitForLoadState("networkidle");

  expect(urls.length).toBeGreaterThan(0);
  const external = urls.filter((u) => {
    const url = new URL(u);
    if (url.protocol === "data:" || url.protocol === "blob:" || url.protocol === "about:") return false;
    return url.host !== ORIGIN;
  });
  expect(external, `requests outside ${ORIGIN}`).toEqual([]);
  // The app asks GET /api/extract once on start whether live reading is on. The preview
  // server has no /api, so it fails and the app stays in recorded mode. That single bare
  // status GET is the only allowed /api/ request; any POST (receipt data) still fails.
  expect(
    apiRequests.filter((r) => !(r.method === "GET" && r.path === "/api/extract")),
    "requests to /api/ other than the status GET",
  ).toEqual([]);
  expect(apiRequests.filter((r) => r.method === "GET").length, "status GETs").toBeLessThanOrEqual(1);
  expect(urls.filter((u) => FONT_HOSTS.test(new URL(u).hostname)), "requests to a font host").toEqual([]);
});
