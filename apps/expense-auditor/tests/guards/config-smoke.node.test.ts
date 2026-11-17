import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// Requirements 6.1, 6.2, 20.1, 20.2, 20.4: deploy config and package pins.
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (name: string): string => readFileSync(join(APP_ROOT, name), "utf8");

describe("config smoke", () => {
  it("vercel.json declares the Vite build and the extract function", () => {
    const cfg = JSON.parse(read("vercel.json"));
    expect(cfg.framework).toBe("vite");
    expect(cfg.installCommand).toBe("pnpm install --frozen-lockfile");
    expect(cfg.buildCommand).toBe("pnpm build");
    expect(cfg.outputDirectory).toBe("dist");
    expect(Object.keys(cfg.functions)).toEqual(["api/extract.ts"]);
    expect(cfg.functions["api/extract.ts"].maxDuration).toBe(30);
  });

  it("vercel.json sets security headers and a CSP without external hosts", () => {
    const cfg = JSON.parse(read("vercel.json"));
    const headers = new Map<string, string>(
      cfg.headers[0].headers.map((h: { key: string; value: string }) => [h.key, h.value]),
    );
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("no-referrer");
    const csp = headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("img-src 'self' blob: data:");
    expect(csp).not.toMatch(/https?:\/\//);
  });

  it(".env.example is off by default and carries no key", () => {
    const lines = read(".env.example")
      .split("\n")
      .filter((l) => l.trim() !== "" && !l.startsWith("#"));
    const env = new Map(lines.map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
    expect(env.get("LIVE_EXTRACTION")).toBe("off");
    expect(env.get("ANTHROPIC_API_KEY")).toBe("");
    expect(env.get("EXTRACTION_MODEL")).toBe("claude-haiku-5-5");
  });

  it("package.json has name, scripts and exact pins", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.name).toBe("@bones/expense-auditor");
    for (const s of ["dev", "build", "test", "typecheck", "test:e2e"]) expect(pkg.scripts[s]).toBeTypeOf("string");
    const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, version] of Object.entries(deps)) {
      if (version.startsWith("workspace:")) continue;
      expect(version, name).not.toMatch(/[\^~]/);
    }
  });
});
