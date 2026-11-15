import type { KernelPorts } from "@bones/core";

export interface PortDeps {
  now?: () => number;
  uuid?: () => string;
}

export interface PortFactory {
  /** Ports for replay and override. The hasher throws. */
  base: KernelPorts;
  /** Ports for createTrace: the hasher returns the precomputed hex. */
  forInput(inputHashHex: string, byteLength: number): KernelPorts;
}

/** A clock whose values are strictly increasing, at least 1 ms apart. */
export function makeClock(now: () => number = Date.now): () => Date {
  let last = -Infinity;
  return () => {
    const t = Math.max(now(), last + 1);
    last = t;
    return new Date(t);
  };
}

export function makePortFactory(deps: PortDeps = {}): PortFactory {
  const clock = makeClock(deps.now);
  const id = deps.uuid ?? (() => globalThis.crypto.randomUUID());
  const noHasher = (): string => {
    throw new Error("hasher port is only available while extracting");
  };
  return {
    base: { clock, id, hasher: noHasher },
    forInput(inputHashHex, byteLength) {
      return {
        clock,
        id,
        hasher: (bytes) => {
          if (bytes.byteLength !== byteLength) {
            throw new Error(
              `hasher length mismatch: hashed ${byteLength} bytes, createTrace passed ${bytes.byteLength} bytes`,
            );
          }
          return inputHashHex;
        },
      };
    },
  };
}
