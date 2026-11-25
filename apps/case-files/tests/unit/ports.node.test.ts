import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/pipeline/hash";
import { makeClock, makePortFactory } from "../../src/pipeline/ports";
import { counterPorts } from "../helpers/fakes";

describe("makeClock", () => {
  it("strictly increases when now() repeats", () => {
    const clock = makeClock(() => 1000);
    const times = [clock(), clock(), clock()].map((d) => d.getTime());
    expect(times).toEqual([1000, 1001, 1002]);
  });

  it("strictly increases when now() goes back", () => {
    const seq = [5000, 4000, 3000, 9000];
    let i = 0;
    const clock = makeClock(() => seq[i++]!);
    const times = [clock(), clock(), clock(), clock()].map((d) => d.getTime());
    expect(times).toEqual([5000, 5001, 5002, 9000]);
  });
});

describe("makePortFactory", () => {
  it("forInput hasher returns the precomputed hex for the right length", () => {
    const ports = makePortFactory(counterPorts()).forInput("ab".repeat(32), 3);
    expect(ports.hasher(new Uint8Array(3))).toBe("ab".repeat(32));
    expect(ports.id()).toBe("id-1");
  });

  it("forInput hasher throws on a byte-length mismatch", () => {
    const ports = makePortFactory(counterPorts()).forInput("ab".repeat(32), 3);
    expect(() => ports.hasher(new Uint8Array(4))).toThrow(/length mismatch/);
  });

  it("base hasher throws", () => {
    expect(() => makePortFactory(counterPorts()).base.hasher(new Uint8Array(0))).toThrow();
  });
});

describe("sha256Hex", () => {
  it("hashes a known string", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await sha256Hex(bytes)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("pipeline purity", () => {
  it("hash.ts has no Date.now and ports.ts only uses it as the default wiring", () => {
    const dir = resolve(__dirname, "../../src/pipeline");
    expect(readFileSync(resolve(dir, "hash.ts"), "utf8")).not.toMatch(/Date\.now/);
    const ports = readFileSync(resolve(dir, "ports.ts"), "utf8");
    const hits = ports.split("\n").filter((l) => /Date\.now/.test(l));
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(/now: \(\) => number = Date\.now/);
  });
});
