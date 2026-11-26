import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXPECTED_MATRIX } from "../fixtures/expected-matrix";
// R22.1, R22.3, R22.4, R24.1: the README names real scripts, ports, Q1 to Q7 and the fixture sentence.
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPO_ROOT = resolve(APP_ROOT, "../..");
const readme = readFileSync(resolve(APP_ROOT, "README.md"), "utf8");
const scriptsOf = (path: string): Record<string, string> =>
  (JSON.parse(readFileSync(path, "utf8")) as { scripts: Record<string, string> }).scripts;
const appScripts = scriptsOf(resolve(APP_ROOT, "package.json"));
const rootScripts = scriptsOf(resolve(REPO_ROOT, "package.json"));
const SKIPPED = new Set(["install", "exec", "-r"]);

/** Every `pnpm ...` command in an inline code span or a code block line. */
function pnpmCommands(text: string): string[] {
  return [...text.matchAll(/`(pnpm [^`]+)`/g)].map((m) => m[1]!);
}

describe("app README", () => {
  it("names only pnpm scripts that exist", () => {
    const commands = pnpmCommands(readme);
    expect(commands.length).toBeGreaterThan(5);
    for (const command of commands) {
      const words = command.split(/\s+/).slice(1);
      let scope: "root" | "app" = "root";
      if (words[0] === "--filter") {
        expect(words[1]).toBe("@bones/case-files");
        scope = "app";
        words.splice(0, 2);
      }
      if (words[0] === "-r") continue; // recursive run of `test` or `typecheck`, checked below
      const first = words[0]!;
      if (SKIPPED.has(first)) continue;
      const scripts = scope === "app" ? appScripts : rootScripts;
      expect(Object.keys(scripts), `script of "${command}"`).toContain(first);
    }
    for (const recursive of ["pnpm -r test", "pnpm -r typecheck"]) expect(readme).toContain(`\`${recursive}\``);
    expect(appScripts).toHaveProperty("test");
    expect(appScripts).toHaveProperty("typecheck");
  });

  it("names every script of the app package", () => {
    for (const name of Object.keys(appScripts)) {
      expect(readme, `script ${name}`).toContain(`pnpm --filter @bones/case-files ${name}\``);
    }
  });

  it("names the ports and Q1 to Q7", () => {
    expect(readme).toContain("5201");
    expect(readme).toContain("5202");
    for (let n = 1; n <= 7; n += 1) expect(readme).toMatch(new RegExp(`\\bQ${n}\\b`));
  });

  it("states honestly that the recorded cases are fixtures (R24.1)", () => {
    expect(readme).toContain(
      "The three recorded cases are hand-written fixtures in the model output format, not real LLM output.",
    );
  });

  it("says that live mode is not built and that the key stays on the server", () => {
    expect(readme).toContain("Live mode is not built in this version.");
    expect(readme).toContain("needs no API key");
    expect(readme).toContain("the key lives only on the server");
  });

  it("repeats the nine-cell matrix of the fixture", () => {
    for (const cell of EXPECTED_MATRIX) {
      const ids = cell.convictable.length === 0 ? "[]" : `[${cell.convictable.join(", ")}]`;
      const row = readme.split("\n").find((l) => l.startsWith(`| ${cell.caseId} |`));
      expect(row, cell.caseId).toBeDefined();
      expect(row!).toContain(`${cell.verdict === "accepted" ? "accepted" : cell.verdict}, ${ids}`);
    }
  });

  it("has no currency word and no secret-like string", () => {
    expect(readme).not.toMatch(/\bEUR\b/);
    expect(readme).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/);
    expect(readme).not.toMatch(/(api[_-]?key|token|secret)\s*[=:]\s*\S{8,}/i);
  });
});
