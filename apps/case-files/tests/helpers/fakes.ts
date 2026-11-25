import type { KernelPorts } from "@bones/core";
import type { PortDeps } from "../../src/pipeline/ports";

/** Fixed clock and counter ids, for tests. The clock ticks by 1 ms per call. */
export function counterPorts(): Required<PortDeps> {
  let t = 1_700_000_000_000;
  let n = 0;
  return {
    now: () => t++,
    uuid: () => `id-${++n}`,
  };
}

/** Kernel ports with a fixed-result hasher, for tests that call core directly. */
export function fixedKernelPorts(hex = "0".repeat(64)): KernelPorts {
  const deps = counterPorts();
  return { clock: () => new Date(deps.now()), id: deps.uuid, hasher: () => hex };
}
