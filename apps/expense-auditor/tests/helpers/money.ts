/** Inverse of formatCents: "$1,234.50" gives 123450. Integer arithmetic only. Returns null when the text does not parse. */
export function parseMoney(text: string, symbol: string): number | null {
  if (!text.startsWith(symbol)) return null;
  const match = /^(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})$/.exec(text.slice(symbol.length));
  if (match === null) return null;
  const whole = Number((match[1] ?? "").replace(/,/g, ""));
  const frac = Number(match[2]);
  return whole * 100 + frac;
}
