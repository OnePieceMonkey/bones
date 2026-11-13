import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReducedMotion, animClass } from "../../hooks/useReducedMotion";
import { cx } from "../../cx";
import {
  installMatchMedia,
  restoreMatchMedia,
  dispatchMatchMediaChange,
} from "../helpers/matchMedia";

afterEach(() => {
  restoreMatchMedia();
});

describe("useReducedMotion", () => {
  it("returns false when matchMedia is unavailable", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when the media query matches", () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("returns false when the media query does not match", () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("override beats the media query in both directions", () => {
    installMatchMedia(true);
    expect(renderHook(() => useReducedMotion(false)).result.current).toBe(false);
    installMatchMedia(false);
    expect(renderHook(() => useReducedMotion(true)).result.current).toBe(true);
  });

  it("updates on a change event", () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => dispatchMatchMediaChange(true));
    expect(result.current).toBe(true);
    act(() => dispatchMatchMediaChange(false));
    expect(result.current).toBe(false);
  });
});

describe("animClass", () => {
  it("prefixes with anim- when motion is allowed", () => {
    expect(animClass(false, "pulse")).toBe("anim-pulse");
  });
  it("returns empty string when reduced", () => {
    expect(animClass(true, "pulse")).toBe("");
  });
});

describe("cx", () => {
  it("joins truthy strings and drops falsy values", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
  });
  it("returns empty string for no parts", () => {
    expect(cx()).toBe("");
  });
  it("composes with animClass", () => {
    expect(cx("bone", animClass(true, "glow"))).toBe("bone");
    expect(cx("bone", animClass(false, "glow"))).toBe("bone anim-glow");
  });
});
