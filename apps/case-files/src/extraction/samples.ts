import { z } from "zod";
import type { ExtractionResult } from "@bones/core";

import { fourSuspectsEntry } from "../../e2e/fixtures/four-suspects";
/** `four-suspects` exists only in the e2e build (CASE_FILES_E2E=1); see `E2E_CASE_IDS`. */
export type RecordedCaseId = "greenhouse" | "candlesticks" | "empty-room" | "four-suspects";
/** Ids that only the e2e build accepts. Empty, and the literal removed, in a normal build. */
const E2E_CASE_IDS: readonly string[] = __CASE_FILES_E2E__ ? ["four-suspects"] : [];
const KNOWN_IDS: readonly string[] = ["greenhouse", "candlesticks", "empty-room", ...E2E_CASE_IDS];

/** The ids of the three Recorded_Cases, in sheet order. */
export const RECORDED_CASE_IDS: readonly RecordedCaseId[] = ["greenhouse", "candlesticks", "empty-room"];

export interface RecordedCase {
  id: RecordedCaseId;
  title: string;
  origin?: "fixture";
  extraction: ExtractionResult;
}

const sourceLocation = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("line"), lineIndex: z.number().int().min(0) }).strict(),
  z
    .object({
      kind: z.literal("bbox"),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .strict(),
]);

/** Stored-entry schema. Strict, and it allows the `origin: "fixture"` label. */
export const recordedCaseSchema = z
  .object({
    id: z.string().refine((id) => KNOWN_IDS.includes(id), "unknown case id"),
    title: z.string().min(1),
    origin: z.literal("fixture").optional(),
    extraction: z
      .object({
        proposedFields: z.record(z.unknown()),
        confidence: z.record(z.number().min(0).max(1)),
        sources: z.record(sourceLocation),
        rawModelOutput: z.string(),
      })
      .strict(),
  })
  .strict() as z.ZodType<RecordedCase, z.ZodTypeDef, unknown>;

const modules = import.meta.glob("../../recorded/*.json", { eager: true, import: "default" });

/** The imported JSON modules, unvalidated, sorted by path. */
export const RECORDED_CASES: readonly unknown[] = [
  ...Object.keys(modules)
    .sort()
    .map((k) => modules[k]),
  // e2e build only: reachable through the adapter, never listed on the start screen (the sheets use RECORDED_CASE_IDS).
  ...(__CASE_FILES_E2E__ ? [fourSuspectsEntry] : []),
];

/** Sheet list helper: id and title of each recorded entry that has both, in sheet order. */
export function recordedSheetList(
  cases: readonly unknown[] = RECORDED_CASES,
): Array<{ id: RecordedCaseId; title: string }> {
  const out: Array<{ id: RecordedCaseId; title: string }> = [];
  for (const id of RECORDED_CASE_IDS) {
    const e = cases.find((c) => typeof c === "object" && c !== null && (c as { id?: unknown }).id === id) as
      | { title?: unknown }
      | undefined;
    if (e !== undefined && typeof e.title === "string") out.push({ id, title: e.title });
  }
  return out;
}
