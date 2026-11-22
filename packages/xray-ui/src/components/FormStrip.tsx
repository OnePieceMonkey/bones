import { useId, useState } from "react";
import type { ReactNode } from "react";
import { IconLoad } from "./HeaderIcons";
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

export interface FormStripFileProps {
  /** Accessible name of the file input, shown as the field label. */
  label: string;
  accept?: string;
  /** Text on the button while no file is chosen. */
  placeholder: string;
  onFile: (file: File | null) => void;
}

/**
 * File field with a custom button. The native input stays in the DOM (visually hidden,
 * focusable); its label span names it and the button shows the chosen file name.
 */
export function FormStripFile({ label, accept, placeholder, onFile }: FormStripFileProps) {
  const labelId = useId();
  const inputId = useId();
  const [name, setName] = useState<string | null>(null);
  return (
    <span className="xr-form-strip-field xr-file">
      <span id={labelId} className="xr-file-label">
        {label}
      </span>
      <input
        id={inputId}
        className="xr-file-input"
        type="file"
        aria-labelledby={labelId}
        {...(accept !== undefined ? { accept } : {})}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0] ?? null;
          setName(file?.name ?? null);
          onFile(file);
        }}
      />
      <label htmlFor={inputId} className="xr-file-button" aria-hidden="true">
        <IconLoad />
        <span className="xr-file-name">{name ?? placeholder}</span>
      </label>
    </span>
  );
}
