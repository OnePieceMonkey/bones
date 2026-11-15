import { parseIsoDate } from "../../shared/iso";
import type { TripWindow } from "../extraction/samples";

export { parseIsoDate, isRealIsoDate } from "../../shared/iso";

export const MONTHS: readonly string[] = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthName(m: number): string {
  return MONTHS[m - 1] ?? "";
}

/** "Mar 15, 2024". Returns the raw text when it is not a real ISO date. */
export function formatDate(iso: string): string {
  const p = parseIsoDate(iso);
  if (p === null) return iso;
  return `${monthName(p.m)} ${p.d}, ${p.y}`;
}

/** "Trip: Mar 10 - Mar 20, 2024"; the year is printed once when both dates share it. */
export function formatTripWindow(trip: TripWindow): string {
  const a = parseIsoDate(trip.start);
  const b = parseIsoDate(trip.end);
  if (a === null || b === null) {
    return `Trip: ${formatDate(trip.start)} - ${formatDate(trip.end)}`;
  }
  if (a.y === b.y) {
    return `Trip: ${monthName(a.m)} ${a.d} - ${monthName(b.m)} ${b.d}, ${b.y}`;
  }
  return `Trip: ${formatDate(trip.start)} - ${formatDate(trip.end)}`;
}
