import { useEffect, useRef, useState } from "react";
import { isCoreError } from "@bones/core";
import { Shell } from "@bones/xray-ui";
import { anatomy } from "../anatomy";
import { formatTripWindow } from "../format/dates";
import { INTRO_DELAY_MS } from "../state/intro";
import type { DecisionState } from "../state/reducer";
import { claimedCentsOf, displayedTrace, effectiveView, replayNote, titlePlate } from "../state/selectors";
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
    <>
      <Shell
        heading="Expense Auditor"
        lightboxLabel={titlePlate(state.origin)}
        introKey={state.sessionId}
        trace={trace}
        anatomy={anatomy}
        source={state.source}
        claimedCents={claimedCentsOf(trace)}
        versions={VERSIONS}
        version={state.selected}
        onVersionChange={(v) => {
          if (isVersionLabel(v)) store.selectVersion(v);
        }}
        xray={state.intro.xray}
        onXrayChange={(next) => store.dispatchIntro({ type: "user", xray: next })}
        onOverride={() => setDialogOpen(true)}
        overrideRef={overruleRef}
        headerActions={<Toolbar state={state} store={store} />}
        statusNote={<VersionNote note={replayNote(state)} />}
        contextNote={formatTripWindow(state.trip)}
        {...(effective === null ? {} : { effective })}
        {...motion}
      />
      <OverrideDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={(form) => store.submitOverride(form)}
        returnFocusTo={overruleRef}
      />
      <ErrorPanel error={state.notice === null ? null : state.notice.error} title="Replay failed" />
      <ErrorPanel error={effectiveError} title="Override could not be applied" />
    </>
  );
}
