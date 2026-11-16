import { useLayoutEffect, useState } from "react";
import type { Rect } from "../model/ruleBoxPlacement";

const ZERO: Rect = { left: 0, top: 0, width: 0, height: 0 };

const same = (a: Rect, b: Rect): boolean =>
  a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;

/**
 * Measures an element with getBoundingClientRect in a layout effect and again
 * when it resizes. Without ResizeObserver (or without an element) it measures
 * once, and a null element gives an all-zero rect.
 */
export function useElementRect(el: Element | null): Rect {
  const [rect, setRect] = useState<Rect>(ZERO);
  useLayoutEffect(() => {
    if (!el) {
      setRect((cur) => (same(cur, ZERO) ? cur : ZERO));
      return undefined;
    }
    const measure = (): void => {
      const r = el.getBoundingClientRect();
      const next: Rect = { left: r.left, top: r.top, width: r.width, height: r.height };
      setRect((cur) => (same(cur, next) ? cur : next));
    };
    measure();
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(measure);
      observer.observe(el);
    }
    if (typeof window !== "undefined") window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      if (typeof window !== "undefined") window.removeEventListener("resize", measure);
    };
  }, [el]);
  return rect;
}
