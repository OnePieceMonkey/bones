import type { LightboxProps } from "../types";

export function Lightbox({ title, xray, children, className, pill = true, plate = true }: LightboxProps) {
  const classes = ["xr-lightbox", className].filter(Boolean).join(" ");
  return (
    <section className={classes} aria-label={title ?? "X-ray viewer"} data-xray={xray ? "true" : "false"}>
      <div className="xr-frame">
        {pill && (
          <span className="xr-pill" data-on={xray ? "true" : "false"}>
            {xray ? "X-RAY ON" : "X-RAY OFF"}
          </span>
        )}
        {plate && title !== undefined && <h2 className="xr-title-plate">{title}</h2>}
        <div className="xr-viewport">{children}</div>
      </div>
    </section>
  );
}
