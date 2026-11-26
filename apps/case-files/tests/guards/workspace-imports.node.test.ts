import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Requirement 20.2 (and 1.4, 1.5): `src` imports only a short allow-list and relative files of its own;
// `shared/` and `api/_lib/` never import `src/`.
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = join(APP_ROOT, "src");
const OTHER_APP = ["expense", "auditor"].join("-"); // two parts, so the cross-app guard does not match this file

const ALLOWED_PACKAGES = new Set(["@bones/core", "@bones/xray-ui", "react", "react-dom", "zod"]);
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SKIPPED_DIRS = new Set(["node_modules", "dist"]);
const NODE_BUILTINS = new Set(builtinModules.map((m) => m.replace(/^node:/, "").split("/")[0]!));

/**
 * The one relative import that leaves `src`: the e2e-only fixture (requirement 20 / task 7.1).
 * It sits behind `__CASE_FILES_E2E__`, and `e2e-fixture-flag.node.test.ts` proves a normal build
 * contains none of it. Nothing else may leave `src`.
 */
export const E2E_FIXTURE_EXCEPTION = {
  file: "src/extraction/samples.ts",
  specifier: "../../e2e/fixtures/four-suspects",
} as const;

const SPECIFIER_PATTERNS: readonly RegExp[] = [
  /\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g,
];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

export function findSpecifiers(text: string): string[] {
  const clean = stripComments(text);
  const out: string[] = [];
  for (const re of SPECIFIER_PATTERNS) for (const m of clean.matchAll(re)) out.push(m[1]!);
  return out;
}

export function packageName(spec: string): string {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

export interface Violation {
  readonly file: string;
  readonly detail: string;
}

/** Checks one `src` file. `relPath` is relative to the app root, with `/` separators. */
export function checkSrcFile(relPath: string, text: string): Violation[] {
  const out: Violation[] = [];
  const fileDir = dirname(join(APP_ROOT, relPath));
  for (const spec of findSpecifiers(text)) {
    if (spec.startsWith("node:")) {
      out.push({ file: relPath, detail: `Node built-in "${spec}"` });
    } else if (spec.startsWith(".")) {
      const target = resolve(fileDir, spec);
      const inside = target === SRC || target.startsWith(SRC + sep);
      const exception = relPath === E2E_FIXTURE_EXCEPTION.file && spec === E2E_FIXTURE_EXCEPTION.specifier;
      if (!inside && !exception) out.push({ file: relPath, detail: `relative import leaves src: "${spec}"` });
    } else if (spec.startsWith("/")) {
      out.push({ file: relPath, detail: `absolute import "${spec}"` });
    } else if (NODE_BUILTINS.has(packageName(spec))) {
      out.push({ file: relPath, detail: `Node built-in "${spec}"` });
    } else if (!ALLOWED_PACKAGES.has(packageName(spec))) {
      out.push({ file: relPath, detail: `package not allowed: "${spec}"` });
    }
  }
  return out;
}

/** Checks one `shared/` or `api/_lib/` file: it must not import `src/`. */
export function checkServerFile(relPath: string, text: string): Violation[] {
  const out: Violation[] = [];
  const fileDir = dirname(join(APP_ROOT, relPath));
  for (const spec of findSpecifiers(text)) {
    const target = spec.startsWith(".") ? resolve(fileDir, spec) : spec;
    const intoSrc =
      (spec.startsWith(".") && (target === SRC || target.startsWith(SRC + sep))) ||
      /^(\.\/|\/)?src(\/|$)/.test(spec) ||
      /^@bones\/case-files(\/|$)/.test(spec);
    if (intoSrc) out.push({ file: relPath, detail: `imports src: "${spec}"` });
  }
  return out;
}

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (SKIPPED_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (CODE_EXTENSIONS.has(extname(full))) out.push(full);
  }
}

function rel(file: string): string {
  return relative(APP_ROOT, file).split(sep).join("/");
}

describe("workspace imports", () => {
  it("src imports only allowed packages and its own files", () => {
    const files: string[] = [];
    walk(SRC, files);
    expect(files.length).toBeGreaterThan(0);
    const violations = files.flatMap((f) => checkSrcFile(rel(f), readFileSync(f, "utf8")));
    expect(violations.map((v) => `${v.file}: ${v.detail}`)).toEqual([]);
  });

  it("shared/ and api/_lib/ never import src/ (passes on an empty set)", () => {
    const files: string[] = [];
    walk(join(APP_ROOT, "shared"), files);
    walk(join(APP_ROOT, "api", "_lib"), files);
    const violations = files.flatMap((f) => checkServerFile(rel(f), readFileSync(f, "utf8")));
    expect(violations.map((v) => `${v.file}: ${v.detail}`)).toEqual([]);
  });

  it("the e2e fixture exception is exactly one import in one file", () => {
    const text = readFileSync(join(APP_ROOT, E2E_FIXTURE_EXCEPTION.file), "utf8");
    const hits = findSpecifiers(text).filter((s) => s.startsWith("../../e2e/"));
    expect(hits).toEqual([E2E_FIXTURE_EXCEPTION.specifier]);
  });

  describe("self-tests: src", () => {
    const bad: Array<[string, string]> = [
      ["node:fs", `import { readFileSync } from "node:fs";`],
      ["bare fs", `import fs from "fs";`],
      ["bare path subpath", `import p from "fs/promises";`],
      ["unlisted package", `import _ from "lodash";`],
      ["scoped unlisted", `import x from "@scope/pkg";`],
      ["other workspace app", `import x from "@bones/${OTHER_APP}";`],
      ["relative out of src", `import x from "../../../other/a";`],
      ["relative into e2e elsewhere", `import x from "../../e2e/fixtures/four-suspects";`],
      ["dynamic import", `const m = await import("lodash");`],
      ["require", `const m = require("child_process");`],
      ["absolute", `import x from "/etc/x";`],
    ];
    for (const [name, text] of bad) {
      it(`flags ${name}`, () => {
        expect(checkSrcFile("src/ui/a.ts", text), text)
          .not.toEqual([]);
      });
    }

    it("accepts the allow-list, subpaths and relative files in src", () => {
      const good = [
        `import a from "@bones/core";`,
        `import b from "@bones/xray-ui";`,
        `import c from "react";`,
        `import d from "react-dom/client";`,
        `import e from "zod";`,
        `import f from "./f";`,
        `import g from "../pipeline/schema";`,
        `import "../styles/app.css";`,
        `// import x from "node:fs";\n/* import y from "lodash"; */`,
      ].join("\n");
      expect(checkSrcFile("src/ui/a.ts", good)).toEqual([]);
    });

    it("allows the e2e fixture import only in its one file", () => {
      const text = `import { x } from "${E2E_FIXTURE_EXCEPTION.specifier}";`;
      expect(checkSrcFile(E2E_FIXTURE_EXCEPTION.file, text)).toEqual([]);
      expect(checkSrcFile("src/ui/a.ts", text)).not.toEqual([]);
      expect(checkSrcFile(E2E_FIXTURE_EXCEPTION.file, `import x from "../../e2e/other";`)).not.toEqual([]);
    });
  });

  describe("self-tests: shared and api/_lib", () => {
    it("flags relative, rooted and package imports of src", () => {
      const bad = [
        `import a from "../src/x";`,
        `import a from "../src/pipeline/schema";`,
        `import a from "src/x";`,
        `import a from "@bones/case-files/src/x";`,
      ];
      for (const text of bad) {
        expect(checkServerFile("shared/a.ts", text), text).not.toEqual([]);
      }
      expect(checkServerFile("api/_lib/a.ts", `import a from "../../src/x";`)).not.toEqual([]);
    });

    it("accepts siblings, shared files and core", () => {
      const good = `import a from "./a";\nimport b from "../shared/b";\nimport c from "@bones/core";\nimport d from "zod";`;
      expect(checkServerFile("api/_lib/a.ts", good)).toEqual([]);
      expect(checkServerFile("shared/a.ts", `import a from "./b";`)).toEqual([]);
    });
  });
});
