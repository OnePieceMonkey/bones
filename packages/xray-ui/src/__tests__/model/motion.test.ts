import { describe, it, expect } from "vitest";
import { isReduced, motionMode } from "../../model/motion";

describe("motion mode resolution", () => {
  const rows: Array<[boolean | undefined, boolean, boolean, string]> = [
    [true, true, true, "reduce"],
    [true, false, true, "reduce"],
    [false, true, false, "full"],
    [false, false, false, "full"],
    [undefined, true, true, "auto"],
    [undefined, false, false, "auto"],
  ];
  it.each(rows)("prop %s, media %s -> reduced %s, mode %s", (prop, media, reduced, mode) => {
    expect(isReduced(prop, media)).toBe(reduced);
    expect(motionMode(prop)).toBe(mode);
  });
});
