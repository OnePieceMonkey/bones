export interface NetSpy {
  calls: string[];
  restore: () => void;
}

/** Replaces fetch, XMLHttpRequest and WebSocket with stubs that record and throw. */
export function installNetSpy(): NetSpy {
  const g = globalThis as unknown as Record<string, unknown>;
  const calls: string[] = [];
  const saved = {
    fetch: g["fetch"],
    XMLHttpRequest: g["XMLHttpRequest"],
    WebSocket: g["WebSocket"],
  };

  g["fetch"] = (...args: unknown[]): never => {
    calls.push(`fetch:${String(args[0])}`);
    throw new Error("network access is forbidden: fetch");
  };
  g["XMLHttpRequest"] = function XMLHttpRequestStub(): never {
    calls.push("XMLHttpRequest");
    throw new Error("network access is forbidden: XMLHttpRequest");
  };
  g["WebSocket"] = function WebSocketStub(url?: unknown): never {
    calls.push(`WebSocket:${String(url)}`);
    throw new Error("network access is forbidden: WebSocket");
  };

  return {
    calls,
    restore: () => {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete g[key];
        else g[key] = value;
      }
    },
  };
}
