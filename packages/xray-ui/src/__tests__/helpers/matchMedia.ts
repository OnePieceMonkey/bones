type MatchMediaFn = typeof window.matchMedia;

let original: MatchMediaFn | undefined;
let installed = false;

/** Installs a window.matchMedia mock; `reduce` drives prefers-reduced-motion. */
export function installMatchMedia(reduce: boolean): void {
  if (!installed) {
    original = window.matchMedia;
    installed = true;
  }
  const mock = (query: string): MediaQueryList => ({
    matches: /prefers-reduced-motion:\s*reduce/.test(query) ? reduce : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: mock,
  });
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
}
