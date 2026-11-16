import type { ReactNode } from "react";
export const TAGLINE = "the skeleton under every AI decision";
export interface HeaderBarProps {
  xray: boolean;
  headerActions?: ReactNode;
  /** Short live status next to the tagline (aria-live polite). */
  statusNote?: ReactNode;
  className?: string;
}
/** Top bar: wordmark and tagline left, X-ray pill centred, actions right. */
export function HeaderBar({ xray, headerActions, statusNote, className }: HeaderBarProps) {
  return (
    <header className={className ? `xr-header ${className}` : "xr-header"}>
      <div className="xr-header-brand">
        <span className="xr-wordmark">BONES</span>
        <span className="xr-tagline">{TAGLINE}</span>
        {statusNote !== undefined && (
          <div className="xr-header-status" aria-live="polite">
            {statusNote}
          </div>
        )}
      </div>
      <span className="xr-header-pill" data-on={xray ? "true" : "false"}>
        {xray ? "X-RAY ON" : "X-RAY OFF"}
      </span>
      <div className="xr-header-actions">{headerActions}</div>
    </header>
  );
}
