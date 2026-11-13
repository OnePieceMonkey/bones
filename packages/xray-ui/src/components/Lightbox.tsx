import type { LightboxProps } from "../types";

// `xray` stays optional until task 13.1 wires XrayView to it.
export type LightboxComponentProps = Omit<LightboxProps, "xray"> & { xray?: boolean };

export function Lightbox({ title, children, className }: LightboxComponentProps) {
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
