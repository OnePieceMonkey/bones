import { expect, test, type Page } from "@playwright/test";
import { openRejectedCandlesticks } from "./fixtures/reference-shots";
// Flat view (X-RAY off) is cream by design. Plate labels and the reject reason line must read at >= 4.5:1.
// Runs in project chromium-1600; the 1440 size is set with page.setViewportSize.
const SIZES = [
  { width: 1600, height: 900 },
  { width: 1440, height: 900 },
] as const;
type Ratio = { sel: string; text: string; ratio: number };
async function measure(page: Page): Promise<Ratio[]> {
  return page.evaluate(() => {
    const parse = (c: string): [number, number, number, number] => {
      const m = c.match(/[\d.]+/g)!.map(Number);
      return [m[0]!, m[1]!, m[2]!, m[3] ?? 1];
    };
    const lum = ([r, g, b]: number[]): number => {
      const f = (v: number): number => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const backdrop = (el: Element): [number, number, number] => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c[3] >= 0.99) return [c[0], c[1], c[2]];
      }
      return [255, 255, 255];
    };
    const out: { sel: string; text: string; ratio: number }[] = [];
    for (const sel of [".xr-ensemble-plate", ".case-reason"]) {
      document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        const fg = parse(getComputedStyle(el).color);
        const l1 = lum(fg);
        const l2 = lum(backdrop(el));
        out.push({ sel, text: el.textContent ?? "", ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) });
      });
    }
    return out;
  });
}
for (const size of SIZES) {
  test(`flat view plate labels and reason line reach 4.5:1 at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openRejectedCandlesticks(page);
    await expect(page.getByRole("switch", { name: "X-RAY" })).toHaveAttribute("aria-checked", "false");
    await expect(page.locator(".case-reason")).toBeVisible();
    const ratios = await measure(page);
    expect(ratios.filter((r) => r.sel === ".xr-ensemble-plate").length, "plates exist").toBeGreaterThan(0);
    expect(ratios.filter((r) => r.sel === ".case-reason").length, "reason line exists").toBeGreaterThan(0);
    for (const r of ratios) expect.soft(r.ratio, `${r.sel} "${r.text}"`).toBeGreaterThanOrEqual(4.5);
  });
}
