import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mergedDeclarations } from "./helpers";

// visual-polish-2 task 3.2: header source checks (R7.1, R7.4, R7.6).
const here = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(join(here, "..", "..", "styles", "tokens.css"), "utf8");

function alphaOf(token: string): number {
  const m = new RegExp(`${token}:\\s*rgba\\([^)]*,\\s*([0-9.]+)\\s*\\)`).exec(tokens);
  if (!m) throw new Error(`missing rgba token ${token}`);
  return Number(m[1]);
}

describe("header styles", () => {
  it("frames the header with a token border, a radius of 14 u and the glass fill", () => {
    const d = mergedDeclarations(".xr-header");
    expect(d["border"]).toBe("1px solid var(--xr-line-header)");
    expect(d["background"]).toBe("var(--xr-bg-header-glass)");
    expect(d["border-radius"]).toMatch(/calc\(14 \*/);
    expect(d["height"]).toMatch(/calc\(40 \*/);
    expect(d["margin"]).toMatch(/calc\(6 \*.*calc\(14 \*/);
  });

  it("makes the pill muted glass that does not use the cyan fill", () => {
    const d = mergedDeclarations(".xr-header-pill");
    expect(d["background"]).toBe("var(--xr-bg-pill)");
    expect(d["color"]).toBe("var(--xr-text-pill)");
    expect(d["border"]).toBe("1px solid var(--xr-line-pill)");
    expect(alphaOf("--xr-bg-pill")).toBeLessThanOrEqual(0.35);
    const on = mergedDeclarations('.xr-header-pill[data-on="true"]');
    expect(JSON.stringify(on)).not.toContain("--xr-bg-cyan-fill");
    expect(mergedDeclarations(".xr-header-pill::before")["content"]).toBe('""');
  });

  it("makes the actions ghost pills with an alpha of at most 0.1", () => {
    const d = mergedDeclarations(".xr-header-action");
    expect(d["border-radius"]).toBe("999px");
    const a = /rgba\([^)]*,\s*([0-9.]+)\)/.exec(d["background"] ?? "");
    expect(Number(a?.[1])).toBeLessThanOrEqual(0.1);
    expect(d["border"]).toMatch(/^1px solid/);
    expect(d["display"]).toBe("inline-flex");
    const focus = mergedDeclarations(".xr-header-action:focus-visible");
    expect(focus["outline"]).toBe("3px solid var(--xr-focus, #3de8ff)");
    expect(focus["box-shadow"]).toContain("--xr-focus-contrast");
  });

  it("keeps the status note free of a box", () => {
    const d = mergedDeclarations('.xr-header-status [role="status"]');
    expect(d["border"]).toBe("0");
    expect(d["background"]).toBe("none");
  });
});
