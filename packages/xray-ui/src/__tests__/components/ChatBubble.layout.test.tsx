import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DoctorPanel } from "../../components/panels/DoctorPanel";
import { buildChatMessages } from "../../model/chat";
import { signatureAnatomy, signatureTrace } from "../helpers/fixtures";

afterEach(cleanup);
const dir = dirname(fileURLToPath(import.meta.url));
const styles = (n: string) => readFileSync(resolve(dir, "../../styles", n), "utf8");

/** All declaration blocks whose selector list mentions `needle`. */
function blocks(source: string, needle: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    if ((m[1] ?? "").includes(needle) && !(m[1] ?? "").includes(">")) out.push(m[2] ?? "");
  }
  return out;
}

describe("Dr. Bones chat bubbles never clip", () => {
  it("renders the full text of every message, including the rule line", () => {
    const trace = signatureTrace();
    const anatomy = signatureAnatomy();
    const { container } = render(<DoctorPanel trace={trace} anatomy={anatomy} claimedCents={48_000} reducedMotion />);
    const shown = [...container.querySelectorAll(".xr-bubble")].map((n) => n.textContent);
    expect(shown).toEqual(buildChatMessages(trace, anatomy).map((m) => m.text));
    expect(shown.some((t) => /Rule \S+ v[\d.]+:/.test(t ?? ""))).toBe(true);
  });

  it("has no fixed height, max-height or hidden overflow on bubbles, typing dots or the log", () => {
    for (const file of ["xray.css", "panels.css"]) {
      for (const needle of [".xr-bubble", ".xr-typing-dots"]) {
        for (const body of blocks(styles(file), needle)) {
          expect(body, `${file} ${needle}`).not.toMatch(/(?<![-\w])(max-)?height\s*:\s*(?!auto|\s)/);
          expect(body, `${file} ${needle}`).not.toMatch(/overflow(-[xy])?\s*:\s*(hidden|clip)/);
          expect(body, `${file} ${needle}`).not.toMatch(/text-overflow|line-clamp/);
        }
      }
    }
    expect(blocks(styles("panels.css"), ".xr-doctor .xr-bubble").join(";")).toMatch(/flex:\s*none/);
  });
});
