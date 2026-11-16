import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { AssetImage } from "../../components/shell/AssetImage";

describe("AssetImage", () => {
  it("sets integer width and height, empty alt and aria-hidden by default", () => {
    const { container } = render(<AssetImage src="/a.webp" width={64} height={32} />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("width")).toBe("64");
    expect(img.getAttribute("height")).toBe("32");
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("aria-hidden")).toBe("true");
    expect(img.hasAttribute("data-failed")).toBe(false);
  });

  it("never sets the loading attribute", () => {
    const { container } = render(<AssetImage src="/a.webp" width={1} height={1} />);
    expect(container.querySelector("img")?.hasAttribute("loading")).toBe(false);
  });

  it("keeps a named image exposed when alt is given", () => {
    const { container } = render(<AssetImage src="/a.webp" width={1} height={1} alt="Dr. Bones" className="x" />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("alt")).toBe("Dr. Bones");
    expect(img.hasAttribute("aria-hidden")).toBe(false);
    expect(img.className).toBe("x");
  });

  it("keeps the element and sets data-failed on a load error", () => {
    const { container } = render(<AssetImage src="/missing.webp" width={10} height={10} />);
    const img = container.querySelector("img") as HTMLImageElement;
    fireEvent.error(img);
    const after = container.querySelector("img") as HTMLImageElement;
    expect(after).not.toBeNull();
    expect(after.getAttribute("data-failed")).toBe("true");
    expect(after.getAttribute("width")).toBe("10");
  });
});
