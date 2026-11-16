import { expect, test } from "@playwright/test";

const ORIGIN = "127.0.0.1:4173";
const FONT_HOSTS = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net|fontawesome\.com|cdn\.jsdelivr\.net|unpkg\.com)$/i;

test("all requests stay on 127.0.0.1:4173, none to /api/ or a font host", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));

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
  expect(urls.filter((u) => /\/api\//.test(new URL(u).pathname)), "requests to /api/").toEqual([]);
  expect(urls.filter((u) => FONT_HOSTS.test(new URL(u).hostname)), "requests to a font host").toEqual([]);
});
