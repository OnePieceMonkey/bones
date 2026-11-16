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

describe("motion.css fracture moment", () => {
  const css = read("motion.css");
  const keyframes = (name: string): string => {
    const m = new RegExp(`@keyframes ${name}\\s*{`).exec(css);
    if (!m) throw new Error(`missing keyframes ${name}`);
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === "{") depth++;
      if (css[i] === "}") depth--;
    }
    return css.slice(start, i - 1);
  };

  it("shakes at most 300 ms, within 4 px, and ends at 0", () => {
    for (const name of ["xr-fx-shake-a", "xr-fx-shake-b"]) {
      const body = keyframes(name);
      const offsets = [...body.matchAll(/translate3d\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px,\s*0\s*\)/g)];
      expect(offsets.length).toBeGreaterThan(2);
      for (const m of offsets) {
        expect(Math.abs(Number(m[1]))).toBeLessThanOrEqual(4);
        expect(Math.abs(Number(m[2]))).toBeLessThanOrEqual(4);
      }
      expect(body).toMatch(/0%,\s*100%\s*{\s*transform:\s*translate3d\(0,\s*0,\s*0\)/);
    }
    expect(keyframes("xr-fx-shake-a")).toBe(keyframes("xr-fx-shake-b"));
    for (const cls of ["xr-shake-a", "xr-shake-b"]) {
      const m = new RegExp(`\\.${cls}\\s*{[^}]*animation:\\s*xr-fx-shake-[ab]\\s+(\\d+)ms`).exec(css);
      expect(m).not.toBeNull();
      expect(Number(m![1])).toBeLessThanOrEqual(300);
    }
  });

  it("ends every one-shot fracture effect by 1200 ms", () => {
    const re = /animation:\s*xr-fx-(flash|burst|fly)\s+(\d+)ms\s+[\w-]+\s+(?:calc\(var\(--xr-fx-delay,\s*0ms\)\s*\+\s*(\d+)ms\)|var\(--xr-fx-delay,\s*0ms\))/g;
    const found = [...css.matchAll(re)];
    expect(new Set(found.map((m) => m[1]))).toEqual(new Set(["flash", "burst", "fly"]));
    for (const m of found) {
      expect(Number(m[2]) + Number(m[3] ?? 0)).toBeLessThanOrEqual(900);
    }
  });

  it("animates only transform, opacity and filter in the fracture keyframes", () => {
    for (const name of ["flash", "burst", "fly", "pulse", "spike-in", "shake-a", "shake-b"]) {
      const props = [...keyframes(`xr-fx-${name}`).matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const p of props) expect(["transform", "opacity", "filter"]).toContain(p);
    }
  });
});

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

describe("motion.css idle motion", () => {
  const css = read("motion.css");
  const body = (name: string): string => {
    const m = new RegExp(`@keyframes ${name}\\s*{`).exec(css);
    if (!m) throw new Error(`missing keyframes ${name}`);
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === "{") depth++;
      if (css[i] === "}") depth--;
    }
    return css.slice(start, i - 1);
  };
  const rule = (animName: string): { selector: string; value: string } => {
    const m = new RegExp(`([^{}]+)\\{[^{}]*animation:\\s*${animName}\\s([^;]*);`).exec(css);
    if (!m) throw new Error(`missing animation ${animName}`);
    return { selector: m[1]!.replace(/\/\*[\s\S]*?\*\//g, "").trim(), value: m[2]! };
  };

  it("cycles skeleton brightness between 0.95 and 1.05 over 4 s", () => {
    const b = body("xr-idle-brightness");
    const values = [...b.matchAll(/brightness\(([\d.]+)\)/g)].map((m) => Number(m[1]));
    expect(Math.min(...values)).toBe(0.95);
    expect(Math.max(...values)).toBe(1.05);
    const { value } = rule("xr-idle-brightness");
    const half = Number(/^([\d.]+)s/.exec(value)![1]);
    expect(value).toMatch(/infinite/);
    expect(value).toMatch(/alternate/);
    expect(Math.abs(half * 2 - 4)).toBeLessThanOrEqual(0.2);
  });

  it("flickers the cone in steps of at most 0.1 within 0 to 1 over 5 s", () => {
    const opacities = [...body("xr-idle-flicker").matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    expect(opacities.length).toBeGreaterThan(2);
    for (const o of opacities) {
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < opacities.length; i++) {
      expect(Math.abs(opacities[i]! - opacities[i - 1]!)).toBeLessThanOrEqual(0.1);
    }
    expect(rule("xr-idle-flicker").value).toMatch(/^5s\b.*infinite/);
  });

  it("sweeps the ECG head from -10% to 100% in 3.2 s, linear, infinite", () => {
    const b = body("xr-idle-ecg-head");
    expect(b).toMatch(/from\s*{\s*transform:\s*translateX\(-10%\)/);
    expect(b).toMatch(/to\s*{\s*transform:\s*translateX\(100%\)/);
    expect(rule("xr-idle-ecg-head").value).toMatch(/^3\.2s linear infinite/);
  });

  it("places the ECG band at 50 % of the full image height", () => {
    const stage = read("stage.css");
    const m = /\.xr-ecg-band\s*{[^}]*top:\s*calc\(\(\s*(\d+)\s*-\s*(\d+)\s*\)\s*\/\s*(\d+)\s*\*\s*100%\)/.exec(stage);
    expect(m).not.toBeNull();
    const [y, top, span] = [Number(m![1]), Number(m![2]), Number(m![3])];
    const cropPct = ((y - top) / span) * 100;
    const fullImagePct = top + (cropPct / 100) * span;
    expect(Math.abs(fullImagePct - 50)).toBeLessThanOrEqual(1);
  });

  it("scopes every idle animation to a live shell with the toggle on", () => {
    for (const name of ["xr-idle-brightness", "xr-idle-flicker", "xr-idle-ecg-head"]) {
      expect(rule(name).selector).toMatch(/^\.xr-shell\.xr-live\[data-xray="true"\]\s/);
    }
    expect(read("stage.css")).not.toMatch(/xr-ecg-head\s*{[^}]*animation/);
    expect(read("stage.css")).not.toMatch(/@keyframes xr-ecg-head/);
  });
});
