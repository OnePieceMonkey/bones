import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const coreRoot = join(__dirname, "..", ".."); // packages/core
const repoRoot = join(coreRoot, "..", "..");

const RULE_FILES = [
  "alcohol-deducting",
  "date-blocking-after",
  "date-blocking-before",
  "line-item-cap",
  "meal-limit-v1",
  "meal-limit-v2",
  "meal-limit-v3",
];
const RULE_SET_FILES = ["expense-v1", "expense-v2", "expense-v3"];

describe("Repo layout: expense rule files", () => {
  for (const name of RULE_FILES) {
    it(`rules/expense-auditor/rules/${name}.json exists`, () => {
      expect(existsSync(join(repoRoot, "rules/expense-auditor/rules", `${name}.json`))).toBe(true);
    });
  }

  for (const name of RULE_SET_FILES) {
    it(`rules/expense-auditor/rule-sets/${name}.json exists`, () => {
      expect(existsSync(join(repoRoot, "rules/expense-auditor/rule-sets", `${name}.json`))).toBe(true);
    });
  }

  it("old fixture directories no longer exist", () => {
    expect(existsSync(join(coreRoot, "test-fixtures/expense/rules"))).toBe(false);
    expect(existsSync(join(coreRoot, "test-fixtures/expense/rule-sets"))).toBe(false);
  });

  it("signature-scenario.json still exists", () => {
    expect(existsSync(join(coreRoot, "test-fixtures/expense/recorded/signature-scenario.json"))).toBe(true);
  });
});

describe("Hook matcher: test-on-rule-change", () => {
  const config = JSON.parse(readFileSync(join(repoRoot, ".kiro/hooks/bones.json"), "utf-8")) as {
    hooks: { name: string; matcher?: string }[];
  };
  const hook = config.hooks.find((h) => h.name === "test-on-rule-change");

  it("hook is defined with a matcher", () => {
    expect(hook?.matcher).toBeTypeOf("string");
  });

  it("matches the moved rule file and the recorded fixture", () => {
    const re = new RegExp(hook!.matcher!);
    expect(re.test("rules/expense-auditor/rules/line-item-cap.json")).toBe(true);
    expect(re.test("packages/core/test-fixtures/expense/recorded/signature-scenario.json")).toBe(true);
  });
});
