// Copied from packages/xray-ui/src/__tests__/helpers/contrast.ts (apps may not import from test folders).

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
