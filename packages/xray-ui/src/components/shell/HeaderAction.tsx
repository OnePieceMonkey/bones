import type { ReactNode } from "react";
export interface HeaderActionProps {
  onClick?: () => void;
  className?: string;
  /** Decorative icon shown before the text. */
  icon?: ReactNode;
  children?: ReactNode;
}
/** Secondary action in the header bar. Smaller and lighter than the wordmark. */
export function HeaderAction({ onClick, className, icon, children }: HeaderActionProps) {
  return (
    <button
      type="button"
      className={className ? `xr-header-action ${className}` : "xr-header-action"}
      {...(onClick ? { onClick } : {})}
    >
      {icon !== undefined && (
        <span className="xr-header-action-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}
