import { defaultFormat } from "@bones/xray-ui";

/**
 * Value formatting for the Case Files Anatomy. Pure and total: never throws.
 * `crime` becomes "<place>, <hh:mm>-<hh:mm>, <item>"; `amountCents` becomes "<n> convictable"
 * (a count, never a currency). Everything else uses the generic xray-ui formatter.
 */

interface Named {
  readonly id: string;
  readonly name: string;
}

export interface FormatLookup {
  readonly places: readonly Named[];
  readonly items: readonly Named[];
}

export function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const isMinute = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1439;

function nameOf(list: readonly Named[], id: unknown): string | null {
  if (typeof id !== "string") return null;
  return list.find((e) => e.id === id)?.name ?? id;
}

export function makeFormatValue(lookup: FormatLookup): (path: string, value: unknown) => string {
  return (path, value) => {
    if (path === "amountCents" && typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
      return `${value} convictable`;
    }
    if (path === "crime" && typeof value === "object" && value !== null) {
      const c = value as Record<string, unknown>;
      const place = nameOf(lookup.places, c.placeId);
      const item = nameOf(lookup.items, c.weaponItemId);
      if (place !== null && item !== null && isMinute(c.startMin) && isMinute(c.endMin)) {
        return `${place}, ${hhmm(c.startMin)}-${hhmm(c.endMin)}, ${item}`;
      }
    }
    return defaultFormat(path, value);
  };
}
