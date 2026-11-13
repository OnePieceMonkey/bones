import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function hasMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function subscribe(cb: () => void): () => void {
  if (!hasMatchMedia()) return () => {};
  const mql = window.matchMedia(QUERY);
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", cb);
    return () => mql.removeEventListener("change", cb);
  }
  mql.addListener(cb);
  return () => mql.removeListener(cb);
}

function getSnapshot(): boolean {
  return hasMatchMedia() ? window.matchMedia(QUERY).matches : false;
}

function getServerSnapshot(): boolean {
  return false;
}

/** True when motion should be reduced. A boolean `override` wins over the media query. */
export function useReducedMotion(override?: boolean): boolean {
  const media = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return override ?? media;
}

/** Returns the `anim-` prefixed class name, or "" in reduced-motion mode. */
export function animClass(reduced: boolean, name: string): string {
  return reduced ? "" : "anim-" + name;
}
