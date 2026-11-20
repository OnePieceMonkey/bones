import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(dir, "../../styles/panels.css"), "utf8");

function block(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`, "m").exec(css)?.[1] ?? "";
}

describe("Document panel mark labels", () => {
  it("lets receipt text wrap so a trailing label is never cut at the paper edge", () => {
    const text = block(".xr-doc .xr-film-text");
    expect(text).toMatch(/white-space:\s*pre-wrap/);
    expect(text).not.toMatch(/white-space:\s*pre;/);
  });

  // visual-polish-2 R4.7 supersedes visual-polish R6: the label hides by opacity, which is not clipping.
  it("keeps each label whole and unclipped", () => {
    const tag = block(".xr-doc .xr-mark-tag");
    expect(tag).toMatch(/white-space:\s*nowrap/);
    expect(tag).toMatch(/max-width:\s*100%/);
    expect(tag).not.toMatch(/overflow\s*:\s*hidden/);
    expect(tag).not.toMatch(/text-overflow/);
  });
});
