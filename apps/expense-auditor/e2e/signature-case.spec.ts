import { expect, test, type Page } from "@playwright/test";
import { inflateSync } from "node:zlib";

async function openSignatureCase(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /signature case/i }).click();
  await page.waitForSelector('.xr-shell[data-intro="done"]', { timeout: 10_000 });
}

test("signature case matches the reference image", async ({ page }) => {
  await openSignatureCase(page);
  await expect(page).toHaveScreenshot("signature-case.png");
});

/** Decodes an 8-bit RGB/RGBA non-interlaced PNG into a pixel reader. */
function decodePng(buf: Buffer): { width: number; height: number; at: (x: number, y: number) => [number, number, number] } {
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9]!;
    } else if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!;
    for (let x = 0; x < stride; x += 1) {
      const cur = raw[y * (stride + 1) + 1 + x]!;
      const a = x >= bpp ? out[y * stride + x - bpp]! : 0;
      const b = y > 0 ? out[(y - 1) * stride + x]! : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp]! : 0;
      let v = cur;
      if (filter === 1) v = cur + a;
      else if (filter === 2) v = cur + b;
      else if (filter === 3) v = cur + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      out[y * stride + x] = v & 255;
    }
  }
  return {
    width,
    height,
    at: (x, y) => {
      const i = y * stride + x * bpp;
      return [out[i]!, out[i + 1]!, out[i + 2]!];
    },
  };
}

test.describe("burst corners (motion allowed)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("no corner of a fractured burst renders pure black", async ({ page }) => {
    await openSignatureCase(page);
    const boxes = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".xr-burst")).map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      }),
    );
    expect(boxes.length, "at least one fractured burst").toBeGreaterThan(0);
    const png = decodePng(await page.screenshot());
    const scale = png.width / 1440; // device pixel ratio of the screenshot
    for (const b of boxes) {
      const corners: Array<[number, number]> = [
        [b.left, b.top],
        [b.right, b.top],
        [b.left, b.bottom],
        [b.right, b.bottom],
      ];
      for (const [cx, cy] of corners) {
        // Sample one pixel inside the box so the corner is never off the edge of the image.
        const x = Math.min(png.width - 1, Math.max(0, Math.round((cx === b.right ? cx - 1 : cx + 1) * scale)));
        const y = Math.min(png.height - 1, Math.max(0, Math.round((cy === b.bottom ? cy - 1 : cy + 1) * scale)));
        const [r, g, bl] = png.at(x, y);
        expect(r + g + bl, `pixel (${x}, ${y}) is not #000000`).toBeGreaterThan(0);
      }
    }
  });
});
