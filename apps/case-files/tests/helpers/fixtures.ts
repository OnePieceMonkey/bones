import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CoreError } from "@bones/core";
import { buildBundle } from "../../src/rules/catalog";
import type { RuleBundle } from "../../src/rules/catalog";

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

export const rulesRoot = resolve(HERE, "../../../../rules/case-files");

/** Reads every JSON file of a rules sub-folder, keyed by file name. */
export function readRuleDir(dir: "rules" | "rule-sets"): Record<string, unknown> {
  const base = resolve(rulesRoot, dir);
  const out: Record<string, unknown> = {};
  for (const name of readdirSync(base).filter((n) => n.endsWith(".json")).sort()) {
    out[name] = JSON.parse(readFileSync(resolve(base, name), "utf8"));
  }
  return out;
}

/** Builds the template bundle from the real rule files with node:fs. */
export function loadTestBundle(): RuleBundle | CoreError {
  return buildBundle(readRuleDir("rules"), readRuleDir("rule-sets"));
}
