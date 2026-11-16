import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "../../styles/xray.css"), "utf8");
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Declarations of every top-level `selector { ... }` block whose selector list contains `selector`. */
function declarations(selector: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const selectors = (m[1] ?? "").split(",").map((s) => s.trim().replace(/\s+/g, " "));
    if (!selectors.includes(selector)) continue;
    for (const decl of (m[2] ?? "").split(";")) {
      const i = decl.indexOf(":");
      if (i < 0) continue;
      out.set(decl.slice(0, i).trim().toLowerCase(), decl.slice(i + 1).trim());
    }
  }
  return out;
}

describe("xray.css answer card rules", () => {
  it("finds the rule blocks (parser sanity)", () => {
    expect(declarations(".xr-answer-body").size).toBeGreaterThan(0);
  });

  it("stacks the crack overlay below the answer body", () => {
    const crack = Number(declarations(".xr-crack-overlay").get("z-index"));
    const body = Number(declarations(".xr-answer-body").get("z-index"));
    expect(Number.isFinite(crack)).toBe(true);
    expect(Number.isFinite(body)).toBe(true);
    expect(crack).toBeLessThan(body);
  });

  it("gives .xr-field an opaque token background", () => {
    const bg = declarations(".xr-field").get("background") ?? "";
    expect(bg).toMatch(/^var\(--xr-bg-/);
    expect(bg).not.toMatch(/transparent|rgba/i);
  });

  it("keeps .xr-stamp in normal flow", () => {
    const position = declarations(".xr-stamp").get("position") ?? "";
    expect(position).not.toMatch(/absolute/);
  });

  it("reserves space for the stamp with a min-height", () => {
    expect(declarations(".xr-stamp-area").has("min-height")).toBe(true);
  });

  // Removed on purpose: the new look needs bundled images, so the blanket url() ban
  // is gone. The path-aware guard in guards/assets-guard.test.ts replaces it.
});
