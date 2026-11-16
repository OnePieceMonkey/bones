function channel(hex: string, start: number): number {
  const c = parseInt(hex.slice(start, start + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a #rrggbb colour. */
export function relativeLuminance(hex: string): number {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return 0.2126 * channel(h, 0) + 0.7152 * channel(h, 2) + 0.0722 * channel(h, 4);
}

/** WCAG contrast ratio between two #rrggbb colours (order independent). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const l1 = Math.max(la, lb);
  const l2 = Math.min(la, lb);
  return (l1 + 0.05) / (l2 + 0.05);
}

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(rgb: Rgb): string {
  return "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
}

/** Per channel: tint * alpha + backdrop * (1 - alpha). */
export function blend(tint: Rgb, alpha: number, backdrop: Rgb): [number, number, number] {
  return [0, 1, 2].map((i) => tint[i]! * alpha + backdrop[i]! * (1 - alpha)) as [number, number, number];
}
