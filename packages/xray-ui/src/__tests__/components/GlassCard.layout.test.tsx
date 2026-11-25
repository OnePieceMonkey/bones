import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GlassCard } from "../../components/panels/GlassCard";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

afterEach(cleanup);
const dir = dirname(fileURLToPath(import.meta.url));
const css = (name: string) => readFileSync(resolve(dir, "../../styles", name), "utf8");

/** Declaration block of the first rule whose selector is exactly `selector`. */
function block(source: string, selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`, "m").exec(source);
  return m?.[1] ?? "";
}

describe("GlassCard layout", () => {
  it("renders one row per labelled field with confidence and the stamp note", () => {
    const base = signatureTrace();
    const trace = { ...base, proposedFields: { ...base.proposedFields, "receipt.alcoholCents": 650 } };
    const { container } = render(<GlassCard trace={trace} anatomy={signatureAnatomy()} showUnlabelled />);
    const rows = container.querySelectorAll(".xr-glass .xr-field");
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) expect(row.textContent).toContain("confidence");
    expect(screen.getByRole("note").textContent).toContain("OVERRULED BY RULE");
  });

  it("puts the stamp in the reserved bottom strip and never clips rows", () => {
    const panels = css("panels.css");
    const stamp = block(panels, ".xr-glass-stamp");
    expect(stamp).toMatch(/position:\s*absolute/);
    expect(stamp).toMatch(/left:/);
    expect(stamp).toMatch(/bottom:/);
    expect(stamp).not.toMatch(/\btop:/);
    // visual-polish-2 R3.4: rotated between -20 and -5 degrees.
    const rot = /rotate\((-?\d+(?:\.\d+)?)deg\)/.exec(stamp);
    expect(rot).not.toBeNull();
    expect(Number(rot![1])).toBeGreaterThanOrEqual(-20);
    expect(Number(rot![1])).toBeLessThanOrEqual(-5);
    expect(block(panels, '.xr-glass[data-overruled="true"]')).toMatch(/padding-bottom:\s*max\(\d+px,\s*calc\((4\d|5\d|6\d) /);
    for (const sel of [".xr-glass .xr-field", ".xr-glass .xr-field dt", ".xr-glass .xr-field dd"]) {
      expect(block(panels, sel)).not.toMatch(/overflow\s*:\s*hidden/);
    }
    expect(block(panels, ".xr-glass .xr-field")).toMatch(/gap:/);
    expect(block(panels, ".xr-glass-body")).toMatch(/overflow-y:\s*auto/);
  });

  // visual-polish-2 R3.1 supersedes visual-polish R3.4 and R7: the card sits at the top centre of the stage.
  it("does not give the card a fixed height and places it at the top centre", () => {
    const shell = block(css("shell.css"), ".xr-shell-stagecell .xr-glass");
    expect(shell).toMatch(/position:\s*absolute/);
    expect(shell).toMatch(/left:/);
    expect(shell).toMatch(/width:/);
    expect(shell).toMatch(/max-height:/);
    expect(shell).not.toMatch(/[^-]height:/);
    expect(shell).not.toMatch(/bottom:/);
    expect(shell).not.toMatch(/left:\s*2%/);
    expect(shell).not.toMatch(/overflow:\s*auto/);
    expect(block(css("shell.css"), '.xr-shell[data-xray="false"] .xr-shell-stagecell .xr-glass')).toMatch(/top:\s*auto/);
  });

  // case-files R13.10, R15.8: optional props, defaults unchanged.
  it("overruled forces cracks and the stamp without any overruled field; stampDetail appears in the stamp", () => {
    const { container } = render(
      <GlassCard trace={signatureTrace()} anatomy={signatureAnatomy()} overruled stampDetail="v2" />,
    );
    expect(container.querySelector(".xr-glass")?.getAttribute("data-overruled")).toBe("true");
    expect(container.querySelector(".xr-cracks")).not.toBeNull();
    const note = screen.getByRole("note");
    expect(note.textContent).toContain("OVERRULED BY RULE");
    expect(note.querySelector(".xr-stamp-bones")?.textContent).toBe("v2");
  });

  it("overruled false keeps the field-based behaviour", () => {
    const base = signatureTrace();
    const trace = { ...base, proposedFields: { ...base.proposedFields, "receipt.alcoholCents": 650 } };
    const off = render(<GlassCard trace={trace} anatomy={signatureAnatomy()} showUnlabelled overruled={false} />);
    const offHtml = off.container.innerHTML;
    cleanup();
    const def = render(<GlassCard trace={trace} anatomy={signatureAnatomy()} showUnlabelled />);
    expect(offHtml).toBe(def.container.innerHTML);
    expect(screen.getByRole("note").textContent).toContain("OVERRULED BY RULE");
  });

  it("lays each field out as a two-column grid with the confidence on its own line", () => {
    const panels = css("panels.css");
    expect(block(panels, ".xr-glass .xr-field")).toMatch(/display:\s*grid/);
    expect(block(panels, ".xr-glass .xr-field")).toMatch(/grid-template-columns:\s*27%/);
    expect(block(panels, ".xr-glass .xr-field dd")).toMatch(/display:\s*grid/);
    const conf = block(panels, ".xr-glass .xr-conf");
    expect(conf).toMatch(/grid-area:\s*conf/);
    expect(conf).toMatch(/display:\s*block/);
    expect(conf).toMatch(/max\(12px/);
    // final review: labels and values at least 14 px.
    expect(block(panels, ".xr-glass .xr-field")).toMatch(/font-size:\s*max\(14px/);
    expect(block(panels, ".xr-glass .xr-field dt")).not.toMatch(/flex:/);
  });
});
