import type { ReactNode } from "react";
export interface HeaderActionProps {
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}
/** Secondary action in the header bar. Smaller and lighter than the wordmark. */
export function HeaderAction({ onClick, className, children }: HeaderActionProps) {
  return (
    <button
      type="button"
      className={className ? `xr-header-action ${className}` : "xr-header-action"}
      {...(onClick ? { onClick } : {})}
    >
      {children}
    </button>
  );
}
