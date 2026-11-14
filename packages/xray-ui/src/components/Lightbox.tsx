import type { LightboxProps } from "../types";

export function Lightbox({ title, xray, children, className }: LightboxProps) {
  const classes = ["xr-lightbox", className].filter(Boolean).join(" ");
  return (
    <section className={classes} aria-label={title ?? "X-ray viewer"}>
      <div className="xr-frame">
        <span className="xr-pill" data-on={xray ? "true" : "false"}>
          {xray ? "X-RAY ON" : "X-RAY OFF"}
        </span>
        {title !== undefined && <h2 className="xr-title-plate">{title}</h2>}
        <div className="xr-viewport">{children}</div>
      </div>
    </section>
  );
}
