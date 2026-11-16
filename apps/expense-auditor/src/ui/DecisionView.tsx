import { useEffect, useRef, useState } from "react";
import { isCoreError } from "@bones/core";
import { XrayView } from "@bones/xray-ui";
import { anatomy } from "../anatomy";
import { formatTripWindow } from "../format/dates";
import { INTRO_DELAY_MS } from "../state/intro";
import type { DecisionState } from "../state/reducer";
import { displayedTrace, effectiveView, replayNote, titlePlate } from "../state/selectors";
import type { SessionStore } from "../state/sessionStore";
import { VERSION_LABELS, isVersionLabel } from "../rules/catalog";
import { ErrorPanel } from "./ErrorPanel";
import { OverrideDialog } from "./OverrideDialog";
import { Toolbar } from "./Toolbar";
import { VersionNote } from "./VersionNote";

export interface DecisionViewProps {
  state: DecisionState;
  store: SessionStore;
  /** Forces the xray-ui motion mode; absent means follow the media query. */
  reducedMotion?: boolean;
}

const VERSIONS: string[] = [...VERSION_LABELS];

export function DecisionView({ state, store, reducedMotion }: DecisionViewProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const overruleRef = useRef<HTMLButtonElement>(null);
  const pending = state.intro.pending;

  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => store.dispatchIntro({ type: "timer" }), INTRO_DELAY_MS);
    return () => clearTimeout(id);
  }, [pending, store]);

  const trace = displayedTrace(state);
  const view = effectiveView(state);
  const effectiveError = view !== null && isCoreError(view) ? view : null;
  const effective = view !== null && !isCoreError(view) ? view : null;
  const motion = reducedMotion === undefined ? {} : { reducedMotion };

  return (
    <div className="app-decision">
      <h1 tabIndex={-1}>Expense Auditor</h1>
      <XrayView
        trace={trace}
        anatomy={anatomy}
        source={state.source}
        title={titlePlate(state.origin)}
        versions={VERSIONS}
        version={state.selected}
        onVersionChange={(v) => {
          if (isVersionLabel(v)) store.selectVersion(v);
        }}
        xray={state.intro.xray}
        onXrayChange={(next) => store.dispatchIntro({ type: "user", xray: next })}
        {...(effective === null ? {} : { effective })}
        {...motion}
      />
      <VersionNote note={replayNote(state)} />
      <p className="app-trip-text">{formatTripWindow(state.trip)}</p>
      {/* Temporary until task 8.3 moves Overrule into the Shell's "Human override" button. */}
      <button type="button" className="app-button" ref={overruleRef} onClick={() => setDialogOpen(true)}>
        Overrule
      </button>
      <Toolbar state={state} store={store} />
      <OverrideDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={(form) => store.submitOverride(form)}
        returnFocusTo={overruleRef}
      />
      <ErrorPanel error={state.notice === null ? null : state.notice.error} title="Replay failed" />
      <ErrorPanel error={effectiveError} title="Override could not be applied" />
    </div>
  );
}
