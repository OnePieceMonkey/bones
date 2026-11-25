import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Test helper for the recorded cases. They are hand-written fixtures. */

const HERE = fileURLToPath(new URL(".", import.meta.url));
export const RECORDED_DIR = join(HERE, "..", "..", "recorded");

export interface RecordedFile {
  readonly fileName: string;
  readonly text: string;
  readonly json: {
    id: string;
    title: string;
    origin?: unknown;
    extraction: {
      proposedFields: Record<string, unknown>;
      confidence: Record<string, number>;
      sources: Record<string, unknown>;
      rawModelOutput: string;
    };
  };
}

/** Reads every `recorded/*.json` file, sorted by file name. */
export function readRecorded(): RecordedFile[] {
  return readdirSync(RECORDED_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((fileName) => {
      const text = readFileSync(join(RECORDED_DIR, fileName), "utf8");
      return { fileName, text, json: JSON.parse(text) };
    });
}
