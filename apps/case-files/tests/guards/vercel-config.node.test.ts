// Guard for the static deploy config (apps/case-files/vercel.json).
// Case Files has no api/ folder, so the file has no "functions" block, and the
// CSP only needs connect-src 'self' (recorded mode makes no network calls).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const file = join(root, "vercel.json");

interface Header {
  key: string;
  value: string;
}
interface VercelConfig {
  framework?: string;
  installCommand?: string;
  buildCommand?: string;
  outputDirectory?: string;
  functions?: unknown;
  headers?: { source: string; headers: Header[] }[];
}

function load(): VercelConfig {
  return JSON.parse(readFileSync(file, "utf8")) as VercelConfig;
}

function headerValue(config: VercelConfig, key: string): string | undefined {
  const all = (config.headers ?? []).flatMap((entry) => entry.headers);
  return all.find((header) => header.key.toLowerCase() === key.toLowerCase())?.value;
}

describe("apps/case-files/vercel.json", () => {
  it("exists and parses", () => {
    expect(existsSync(file)).toBe(true);
    expect(() => load()).not.toThrow();
  });

  it("builds a static Vite site with the same commands as the other app", () => {
    const config = load();
    expect(config.framework).toBe("vite");
    expect(config.installCommand).toBe("pnpm install --frozen-lockfile");
    expect(config.buildCommand).toBe("pnpm build");
    expect(config.outputDirectory).toBe("dist");
    expect(config.functions).toBeUndefined();
  });

  it("sets the security headers", () => {
    const config = load();
    expect(headerValue(config, "X-Content-Type-Options")).toBe("nosniff");
    expect(headerValue(config, "X-Frame-Options")).toBe("DENY");
    expect(headerValue(config, "Referrer-Policy")).toBe("no-referrer");
    expect(headerValue(config, "Permissions-Policy")).toBeTruthy();
  });

  it("has a CSP with self-only connections, no remote hosts and no framing", () => {
    const csp = headerValue(load(), "Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/https?:\/\//);
    expect(csp).not.toContain("'unsafe-eval'");
  });
});
