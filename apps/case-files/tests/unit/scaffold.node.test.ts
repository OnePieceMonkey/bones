import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPO_ROOT = resolve(APP_ROOT, "../..");
const read = (p: string): string => readFileSync(p, "utf8");

describe("case-files scaffold", () => {
  const vite = read(resolve(APP_ROOT, "vite.config.ts"));
  const pw = read(resolve(APP_ROOT, "playwright.config.ts"));
  const pkg = JSON.parse(read(resolve(APP_ROOT, "package.json"))) as {
    name: string;
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  it("uses ports 5201 and 5202 with strictPort", () => {
    expect(vite).toContain("port: 5201");
    expect(vite).toContain("port: 5202");
    expect(vite.match(/strictPort: true/g)).toHaveLength(2);
    expect(pw).toContain("5202");
    expect(pw).toContain("--strictPort");
  });

  it("has the scripts of the design", () => {
    expect(Object.keys(pkg.scripts).sort()).toEqual(
      ["build", "build:check", "dev", "preview", "test", "test:e2e", "typecheck"],
    );
  });

  it("declares only the allowed runtime dependencies, all pinned", () => {
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["@bones/core", "@bones/xray-ui", "react", "react-dom", "zod"]);
    for (const [name, v] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      if (name.startsWith("@bones/")) expect(v).toBe("workspace:*");
      else expect(v, name).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("root package.json has the case-files scripts", () => {
    const root = JSON.parse(read(resolve(REPO_ROOT, "package.json"))) as { scripts: Record<string, string> };
    expect(root.scripts["dev:case-files"]).toBe("pnpm --filter @bones/case-files dev");
    expect(root.scripts["e2e:case-files"]).toBe("pnpm --filter @bones/case-files test:e2e");
  });
});
