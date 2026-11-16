import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INTRO } from "../model/introSchedule";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string): string => readFileSync(resolve(here, "../styles", name), "utf8");

function ms(css: string, prop: string): number {
  const m = new RegExp(`${prop}:\\s*(\\d+)ms`).exec(css);
  if (!m) throw new Error(`missing ${prop}`);
  return Number(m[1]);
}

describe("intro.css constants", () => {
  const css = read("intro.css");
  it("match the INTRO constants", () => {
    expect(ms(css, "--xr-t-flicker")).toBe(INTRO.FLICKER_MS);
    expect(ms(css, "--xr-t-cone-from")).toBe(INTRO.CONE_FROM);
    expect(ms(css, "--xr-t-cone-to")).toBe(INTRO.CONE_TO);
    expect(ms(css, "--xr-t-sweep-from")).toBe(INTRO.SWEEP_FROM);
    expect(ms(css, "--xr-t-sweep-to")).toBe(INTRO.SWEEP_TO);
    expect(ms(css, "--xr-t-light-from")).toBe(INTRO.LIGHT_FROM);
    expect(ms(css, "--xr-t-light-ms")).toBe(INTRO.LIGHT_MS);
  });
  it("animates only under the running intro scope and uses fill-mode both", () => {
    const anims = [...css.matchAll(/([^{}]+)\{[^{}]*\banimation:([^;]*);/g)];
    const scoped = anims.filter((m) => /\.xr-shell\.xr-live\[data-intro="running"\]/.test(m[1]!));
    expect(scoped).toHaveLength(4);
    for (const m of scoped) expect(m[2]).toMatch(/\bboth\b/);
  });
});
