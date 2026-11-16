import { useState } from "react";

export interface AssetImageProps {
  src: string;
  width: number;
  height: number;
  className?: string;
  /** Default "" (decorative); the image is then hidden from assistive tech. */
  alt?: string;
}

/**
 * Image with fixed intrinsic size and a quiet failure mode: on a load error
 * the element stays in the layout and is hidden, so no broken-image icon
 * appears and nothing shifts. Never sets `loading`, so first-paint images are
 * not deferred.
 */
export function AssetImage({ src, width, height, className, alt = "" }: AssetImageProps) {
  const [failed, setFailed] = useState(false);
  const decorative = alt === "";
  return (
    <img
      src={src}
      width={width}
      height={height}
      alt={alt}
      {...(className !== undefined ? { className } : {})}
      {...(decorative ? { "aria-hidden": true as const } : {})}
      {...(failed ? { "data-failed": "true" } : {})}
      onError={() => setFailed(true)}
    />
  );
}
