import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fourSuspectsEntry } from "../../e2e/fixtures/four-suspects";
import { isCoreError } from "@bones/core";
import { deriveFacts } from "../../src/derive/factDeriver";
import { caseFieldsSchema } from "../../src/pipeline/schema";
import { solve } from "../../src/solver/solve";
import type { VersionLabel } from "../../src/rules/catalog";
import { loadTestBundle } from "../helpers/fixtures";
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
function filesOf(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesOf(join(dir, e.name)) : [join(dir, e.name)],
  );
}
describe("e2e fixture flag", () => {
  it("the four-suspects fixture has 4 suspects of 5 statements and is valid", () => {
    const { confidence: _c, ...fields } = fourSuspectsEntry.extraction.proposedFields;
    const parsed = caseFieldsSchema.safeParse(fields);
    expect(parsed.success).toBe(true);
    expect(fields.suspects).toHaveLength(4);
    for (const s of fields.suspects) expect(s.statements).toHaveLength(5);
  });
  it("the fixture is a fair case: only the widow is convictable under v1, v2 and v3", () => {
    const { confidence: _c, ...fields } = fourSuspectsEntry.extraction.proposedFields;
    const parsed = caseFieldsSchema.parse(fields);
    const bundle = loadTestBundle();
    if (isCoreError(bundle)) throw new Error(bundle.message);
    for (const label of ["v1", "v2", "v3"] as VersionLabel[]) {
      const solved = solve(deriveFacts(parsed), label, bundle);
      if (isCoreError(solved)) throw new Error(solved.message);
      expect({ label, convictable: solved.convictable }).toEqual({ label, convictable: ["widow"] });
    }
  });
  it("a normal build contains neither the fixture id nor the hook", () => {
    const out = mkdtempSync(join(tmpdir(), "cf-normal-"));
    try {
      const env = { ...process.env };
      delete env.CASE_FILES_E2E;
      execFileSync("pnpm", ["exec", "vite", "build", "--outDir", out, "--emptyOutDir"], {
        cwd: APP_ROOT,
        env,
        stdio: "pipe",
      });
      const text = filesOf(out)
        .filter((f) => /\.(js|html|css)$/.test(f))
        .map((f) => readFileSync(f, "utf8"))
        .join("\n");
      expect(text).not.toContain("four-suspects");
      expect(text).not.toContain("__caseFilesE2E");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 120_000);
  it("the e2e build contains both", () => {
    const out = mkdtempSync(join(tmpdir(), "cf-e2e-"));
    try {
      execFileSync("pnpm", ["exec", "vite", "build", "--outDir", out, "--emptyOutDir"], {
        cwd: APP_ROOT,
        env: { ...process.env, CASE_FILES_E2E: "1" },
        stdio: "pipe",
      });
      const text = filesOf(out)
        .filter((f) => f.endsWith(".js"))
        .map((f) => readFileSync(f, "utf8"))
        .join("\n");
      expect(text).toContain("four-suspects");
      expect(text).toContain("__caseFilesE2E");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 120_000);
});
