import type { ReactNode } from "react";
import { skeletonUrl } from "../../assets";
import { cx } from "../../cx";
import { AssetImage } from "../shell/AssetImage";
export interface SkeletonPhotoProps {
  className?: string;
  /** Layers placed inside the photo box (hotspots, ECG band, scan line). */
  children?: ReactNode;
}
const IMAGE_WIDTH = 1208;
const IMAGE_HEIGHT = 1800;
/**
 * Stage cell plus the cropped photo box. The cell is a size container; the
 * box keeps the crop's aspect ratio (1208 x 1116) and is the only element
 * that scales, so percent positions inside it never drift.
 */
export function SkeletonPhoto({ className, children }: SkeletonPhotoProps) {
  return (
    <div className={cx("xr-stage", className)}>
      <div className="xr-photo">
        <AssetImage className="xr-photo-img" src={skeletonUrl} width={IMAGE_WIDTH} height={IMAGE_HEIGHT} />
        {children}
      </div>
    </div>
  );
}
