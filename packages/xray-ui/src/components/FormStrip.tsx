import type { ReactNode } from "react";
import type { CommonProps } from "../types";
import { cx } from "../cx";

export interface FormStripProps extends CommonProps {
  /** Accessible group name, shown as a small caption. */
  legend: string;
  /** Labelled controls. Use `FormStripField` for each label + control pair. */
  children?: ReactNode;
  disabled?: boolean;
}

/** Compact one-row form group for the lightbox. Pins itself to the bottom edge. */
export function FormStrip({ legend, children, disabled, className }: FormStripProps) {
  return (
    <fieldset className={cx("xr-form-strip", className)} {...(disabled ? { disabled: true } : {})}>
      <legend className="xr-form-strip-legend">{legend}</legend>
      {children}
    </fieldset>
  );
}

export interface FormStripFieldProps {
  label: string;
  /** The control, placed inside the label so the label names it. */
  children: ReactNode;
}

export function FormStripField({ label, children }: FormStripFieldProps) {
  return (
    <label className="xr-form-strip-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
