import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SkeletonPhoto } from "../../components/stage/SkeletonPhoto";
import { CROP } from "../../model/anchors";
const css = readFileSync(resolve(__dirname, "../../styles/stage.css"), "utf8");
function rule(selector: string): string {
  const m = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`).exec(css);
  if (!m) throw new Error(`missing rule ${selector}`);
  return m[1] ?? "";
}
describe("SkeletonPhoto", () => {
  it("renders the photo with fixed size, empty alt and no loading attribute", () => {
    const { container } = render(<SkeletonPhoto />);
    const img = container.querySelector("img.xr-photo-img") as HTMLImageElement;
    expect(img.getAttribute("width")).toBe("1208");
    expect(img.getAttribute("height")).toBe("1800");
    expect(img.getAttribute("alt")).toBe("");
    expect(img.hasAttribute("loading")).toBe(false);
  });
  it("renders children inside the photo box", () => {
    const { container } = render(
      <SkeletonPhoto>
        <i data-testid="layer" />
      </SkeletonPhoto>,
    );
    expect(container.querySelector(".xr-photo [data-testid='layer']")).not.toBeNull();
  });
  it("crop style constants match CROP (3 to 65)", () => {
    const span = CROP.bottom - CROP.top;
    expect(span).toBe(62);
    const body = rule(".xr-photo-img");
    const height = Number(/height:\s*([\d.]+)%/.exec(body)?.[1]);
    const top = Number(/top:\s*(-[\d.]+)%/.exec(body)?.[1]);
    expect(height).toBeCloseTo(10000 / span, 1);
    expect(top).toBeCloseTo((-CROP.top / span) * 100, 1);
    expect(body).toMatch(/mix-blend-mode:\s*screen/);
    const box = rule(".xr-photo");
    expect(box).toMatch(/aspect-ratio:\s*1208\s*\/\s*1116/);
    // visual-polish-2 R3.5 supersedes visual-polish R5: the width comes from --xr-photo-w (defined on the stage cell).
    expect(box).toMatch(/width:\s*var\(--xr-photo-w\)/);
    expect(box).toMatch(/flex:\s*none/);
    expect(rule(".xr-stage")).toMatch(/place-items:\s*end center/);
    expect(rule(".xr-stage")).toMatch(/container-type:\s*size/);
  });
  it("keeps the photo box when the image fails to load", () => {
    const { container } = render(<SkeletonPhoto />);
    const img = container.querySelector("img.xr-photo-img") as HTMLImageElement;
    fireEvent.error(img);
    expect(img.getAttribute("data-failed")).toBe("true");
    expect(container.querySelector(".xr-photo")).not.toBeNull();
    expect(container.querySelector("img.xr-photo-img")).toBe(img);
  });
});
