import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CoreError } from "@bones/core";
import { buildBundle } from "../../src/rules/catalog";
import type { RuleBundle } from "../../src/rules/catalog";

const here = dirname(fileURLToPath(import.meta.url));
export const rulesRoot = resolve(here, "../../../../rules/expense-auditor");

/** Reads every JSON file of a rules sub-folder, keyed by file name. */
export function readRuleDir(dir: "rules" | "rule-sets"): Record<string, unknown> {
  const base = resolve(rulesRoot, dir);
  const out: Record<string, unknown> = {};
  for (const name of readdirSync(base).filter((n) => n.endsWith(".json")).sort()) {
    out[name] = JSON.parse(readFileSync(resolve(base, name), "utf8"));
  }
  return out;
}

/** Builds the bundle from the real rule files with node:fs. */
export function loadTestBundle(): RuleBundle | CoreError {
  return buildBundle(readRuleDir("rules"), readRuleDir("rule-sets"));
}
