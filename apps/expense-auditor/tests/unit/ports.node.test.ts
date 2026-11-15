import { describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/pipeline/hash";
import { makeClock, makePortFactory } from "../../src/pipeline/ports";
import { counterPorts } from "../helpers/fakes";

describe("sha256Hex", () => {
  it("matches the known vector for 'abc'", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("port factory", () => {
  it("forInput hasher returns the hex for a matching length", () => {
    const ports = makePortFactory(counterPorts()).forInput("abc123", 3);
    expect(ports.hasher(new Uint8Array(3))).toBe("abc123");
  });

  it("forInput hasher throws naming both lengths on a mismatch", () => {
    const ports = makePortFactory(counterPorts()).forInput("abc123", 5);
    expect(() => ports.hasher(new Uint8Array(6))).toThrow(/5.*6/);
  });

  it("base hasher throws", () => {
    expect(() => makePortFactory(counterPorts()).base.hasher(new Uint8Array(1))).toThrow();
  });

  it("uses crypto.randomUUID by default", () => {
    const id = makePortFactory().base.id();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("uses the injected uuid and shares one clock between base and forInput", () => {
    const factory = makePortFactory(counterPorts());
    expect(factory.base.id()).toBe("id-1");
    const a = factory.base.clock().getTime();
    const b = factory.forInput("h", 0).clock().getTime();
    expect(b).toBeGreaterThan(a);
  });
});

describe("makeClock", () => {
  it("advances equal timestamps by 1 ms", () => {
    const clock = makeClock(() => 1000);
    expect([clock().getTime(), clock().getTime(), clock().getTime()]).toEqual([1000, 1001, 1002]);
  });
});
