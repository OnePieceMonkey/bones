export interface IsoDateParts {
  y: number;
  m: number;
  d: number;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(y: number): boolean {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
}

function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}

/** Real calendar date in YYYY-MM-DD form, or null. No Date object, so no time zone effects. */
export function parseIsoDate(s: string): IsoDateParts | null {
  if (typeof s !== "string") return null;
  const match = ISO.exec(s);
  if (match === null) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export function isRealIsoDate(s: string): boolean {
  return parseIsoDate(s) !== null;
}
