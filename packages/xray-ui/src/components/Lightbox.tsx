import type { ReactNode } from "react";

export interface LightboxProps {
  title?: string;
  children?: ReactNode;
  className?: string;
}

export function Lightbox({ title, children, className }: LightboxProps) {
  const classes = ["xr-lightbox", className].filter(Boolean).join(" ");
  return (
    <section className={classes} aria-label={title ?? "X-ray viewer"}>
      <div className="xr-frame">
        {title !== undefined && <h2 className="xr-title-plate">{title}</h2>}
        <div className="xr-viewport">{children}</div>
      </div>
    </section>
  );
}
