// Fracture burst and splinters use mix-blend-mode: screen. Any ancestor between them and
// the skeleton photo that forms a stacking context turns the blend into "screen over a
// transparent group", which paints black squares.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Stage } from "../../components/stage/Stage";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

afterEach(cleanup);

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../styles");
const css = readdirSync(stylesDir)
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(resolve(stylesDir, f), "utf8"))
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

interface Rule {
  selector: string;
  body: string;
}

function rules(): Rule[] {
  const out: Rule[] = [];
  // Flat rules only; @keyframes bodies are skipped because they are not selectors of ancestors.
  const withoutKeyframes = css.replace(/@keyframes[^{]+{(?:[^{}]*{[^{}]*})*[^{}]*}/g, "");
  for (const m of withoutKeyframes.matchAll(/([^{}@]+){([^{}]*)}/g)) {
    out.push({ selector: m[1]!.trim(), body: m[2]! });
  }
  return out;
}

/** Why a declaration block forms a stacking context, or null. */
function stackingReason(body: string): string | null {
  const decl = (name: string): string | null => {
    const m = new RegExp(`(?:^|;|\\s)${name}\\s*:\\s*([^;]+)`).exec(body);
    return m ? m[1]!.trim() : null;
  };
  const none = (v: string | null): boolean => v === null || v === "none" || v === "auto" || v === "normal";
  if (!none(decl("transform"))) return "transform";
  if (!none(decl("filter"))) return "filter";
  if (!none(decl("backdrop-filter"))) return "backdrop-filter";
  if (!none(decl("will-change"))) return "will-change";
  if (decl("isolation") === "isolate") return "isolation";
  const opacity = decl("opacity");
  if (opacity !== null && Number(opacity) < 1) return "opacity";
  const z = decl("z-index");
  const position = decl("position");
  if (z !== null && z !== "auto" && position !== null && position !== "static") return "z-index";
  if (!none(decl("mix-blend-mode")) && decl("mix-blend-mode") !== "normal") return "mix-blend-mode";
  return null;
}

function lastCompound(selector: string): string {
  const parts = selector.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

describe("fracture fx layer stacking", () => {
  it("renders .xr-fx next to the hotspot, not inside it", () => {
    const { container } = render(<Stage trace={signatureTrace()} anatomy={signatureAnatomy()} />);
    const fx = container.querySelectorAll(".xr-fx");
    expect(fx.length).toBeGreaterThan(0);
    for (const el of fx) {
      expect(el.closest(".xr-hotspot")).toBeNull();
      expect(el.parentElement?.classList.contains("xr-hotspot-wrap")).toBe(true);
    }
  });

  it("has no ancestor class up to .xr-photo whose CSS forms a stacking context", () => {
    const { container } = render(<Stage trace={signatureTrace()} anatomy={signatureAnatomy()} />);
    const burst = container.querySelector(".xr-burst");
    expect(burst).not.toBeNull();
    const classes = new Set<string>();
    let node: Element | null = burst!.parentElement;
    let reachedPhoto = false;
    while (node) {
      for (const c of node.classList) classes.add(c);
      if (node.classList.contains("xr-photo")) {
        reachedPhoto = true;
        break;
      }
      node = node.parentElement;
    }
    expect(reachedPhoto).toBe(true);
    expect(classes.has("xr-fx")).toBe(true);
    expect(classes.has("xr-hotspot-wrap")).toBe(true);
    expect(classes.has("xr-hotspots")).toBe(true);

    const offenders: string[] = [];
    for (const rule of rules()) {
      for (const sel of rule.selector.split(",")) {
        const compound = lastCompound(sel.trim());
        const hit = [...classes].find((c) => new RegExp(`\\.${c}(?![\\w-])`).test(compound));
        // Pseudo-elements (the scan line) are siblings of the content, not ancestors.
        if (!hit || compound.includes("::")) continue;
        const reason = stackingReason(rule.body);
        if (reason) offenders.push(`${sel.trim()} -> ${reason}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
