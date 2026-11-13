type MatchMediaFn = typeof window.matchMedia;

let original: MatchMediaFn | undefined;
let installed = false;
let currentReduce = false;
const listeners = new Set<(e: MediaQueryListEvent) => void>();

/** Installs a window.matchMedia mock; `reduce` drives prefers-reduced-motion. */
export function installMatchMedia(reduce: boolean): void {
  if (!installed) {
    original = window.matchMedia;
    installed = true;
  }
  currentReduce = reduce;
  listeners.clear();
  const mock = (query: string): MediaQueryList => {
    const isReduce = /prefers-reduced-motion:\s*reduce/.test(query);
    return {
      get matches() {
        return isReduce ? currentReduce : false;
      },
      media: query,
      onchange: null,
      addListener: (cb: (e: MediaQueryListEvent) => void) => void listeners.add(cb),
      removeListener: (cb: (e: MediaQueryListEvent) => void) => void listeners.delete(cb),
      addEventListener: (_t: string, cb: EventListenerOrEventListenerObject) =>
        void listeners.add(cb as (e: MediaQueryListEvent) => void),
      removeEventListener: (_t: string, cb: EventListenerOrEventListenerObject) =>
        void listeners.delete(cb as (e: MediaQueryListEvent) => void),
      dispatchEvent: () => false,
    } as MediaQueryList;
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: mock,
  });
}

/** Changes the mocked preference and fires `change` on subscribed listeners. */
export function dispatchMatchMediaChange(reduce: boolean): void {
  currentReduce = reduce;
  const event = { matches: reduce, media: "(prefers-reduced-motion: reduce)" } as MediaQueryListEvent;
  for (const cb of [...listeners]) cb(event);
}

export function restoreMatchMedia(): void {
  if (!installed) return;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: original,
  });
  original = undefined;
  installed = false;
  listeners.clear();
}
