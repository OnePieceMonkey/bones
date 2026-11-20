import type { ReactNode } from "react";
export const TAGLINE = "the skeleton under every AI decision";
export interface HeaderBarProps {
  xray: boolean;
  headerActions?: ReactNode;
  /** Short live status next to the tagline (aria-live polite). */
  statusNote?: ReactNode;
  /** Extra context kept in the DOM and the accessibility tree, not drawn. */
  contextNote?: ReactNode;
  className?: string;
}
/** Top bar: wordmark and tagline left, X-ray pill centred, actions right. */
export function HeaderBar({ xray, headerActions, statusNote, contextNote, className }: HeaderBarProps) {
  return (
    <header className={className ? `xr-header ${className}` : "xr-header"}>
      <div className="xr-header-brand">
        <span className="xr-wordmark">BONES</span>
        <span className="xr-tagline">{TAGLINE}</span>
        {contextNote !== undefined && <span className="xr-visually-hidden">{contextNote}</span>}
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
