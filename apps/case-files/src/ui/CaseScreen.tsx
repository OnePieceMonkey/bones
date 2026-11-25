import { useMemo, useRef, useState } from "react";
import { isCoreError } from "@bones/core";
import type { ChatMessage, EffectiveResult } from "@bones/xray-ui";
import {
  ControlPanel,
  DoctorPanel,
  DocumentPanel,
  GlassCard,
  HoveredRuleProvider,
  ShellFrame,
  SkeletonEnsemble,
  buildChatMessages,
} from "@bones/xray-ui";
import { buildCombinedAnatomy, buildSuspectAnatomy } from "../anatomy";
import type { DerivedCase } from "../derive/factDeriver";
import { VERSION_LABELS, isVersionLabel, loadBundle } from "../rules/catalog";
import type { RuleBundle } from "../rules/catalog";
import { solve } from "../solver/solve";
import { buildSolverMessages } from "../solver/solverMessages";
import { introPhaseFor } from "../state/intro";
import type { CaseState } from "../state/reducer";
import { displayedTrace, effectiveView } from "../state/selectors";
import type { SessionStore } from "../state/sessionStore";
import { ErrorPanel } from "./ErrorPanel";
import { OverrideDialog } from "./OverrideDialog";
import { Toolbar } from "./Toolbar";
import { VersionNote, versionNoteText } from "./VersionNote";

export interface CaseScreenProps {
  state: CaseState;
  store: SessionStore;
  /** The template rule bundle; defaults to the bundled rule files. Used for the Solver reason text. */
  bundle?: RuleBundle;
  /** Forces the xray-ui motion mode; absent means follow the media query. */
  reducedMotion?: boolean;
}

const VERSIONS: string[] = [...VERSION_LABELS];

/** D25: per-character delay between 4 and 24 ms, sized so that typing the whole log takes at most 8000 ms where the minimum delay allows. */
export const CHAT_BUDGET_MS = 8000;
export function chatSpeedMs(messages: readonly { text: string }[]): number {
  const chars = messages.reduce((n, m) => n + m.text.length, 0);
  if (chars === 0) return 24;
  return Math.min(24, Math.max(4, Math.floor(CHAT_BUDGET_MS / chars)));
}

/** Plain-text lines of the document panel: the Crime line, the Clues and the Statements of one suspect. */
export function caseDocumentText(
  derived: DerivedCase,
  formatCrime: (crime: unknown) => string,
  selectedSuspectId: string | null,
): string {
  const lines: string[] = [`Crime: ${formatCrime(derived.crime)}`, "", "Clues:"];
  derived.clues.forEach((c, i) => lines.push(`${i + 1}. ${c.text} (${c.reliability})`));
  lines.push("");
  const suspect = derived.suspects.find((s) => s.id === selectedSuspectId);
  if (suspect === undefined) {
    lines.push("Statements: pick a suspect to read what they said.");
  } else {
    lines.push(`Statements of ${suspect.name}:`);
    suspect.statements.forEach((st, j) => lines.push(`${j + 1}. ${st.text}`));
  }
  return lines.join("\n");
}

const ACCUSE_NEEDS_SUSPECT = "Pick a suspect to accuse.";

export function CaseScreen({ state, store, bundle, reducedMotion }: CaseScreenProps) {
  const [replayKey, setReplayKey] = useState(0);
  const [accuseError, setAccuseError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const overrideRef = useRef<HTMLButtonElement>(null);
  const rules = useMemo(() => bundle ?? loadBundle(), [bundle]);

  const trace = displayedTrace(state);
  const derived = trace.validatedFields as unknown as DerivedCase;
  const combined = useMemo(() => buildCombinedAnatomy(derived), [derived]);
  const members = useMemo(
    () =>
      derived.suspects.map((s) => ({
        id: s.id,
        label: s.name,
        anatomy: buildSuspectAnatomy(combined, s),
      })),
    [derived, combined],
  );

  const view = effectiveView(state);
  const effectiveError = view !== null && isCoreError(view) ? view : null;
  const effective: EffectiveResult | null = view !== null && !isCoreError(view) ? view : null;
  const effectiveResult = effective?.result ?? trace.result;
  const rejected = effectiveResult === "rejected";

  const extraMessages = useMemo<ChatMessage[]>(() => {
    if (isCoreError(rules)) return [];
    const solved = solve(derived, state.selected, rules);
    if (isCoreError(solved)) return [];
    const names = new Map(derived.suspects.map((s) => [s.id, s.name] as const));
    return buildSolverMessages(solved, null, names);
  }, [rules, derived, state.selected]);

  const speedMs = useMemo(
    () => chatSpeedMs([...buildChatMessages(trace, combined), ...extraMessages]),
    [trace, combined, extraMessages],
  );

  const text = useMemo(
    () => caseDocumentText(derived, (c) => combined.formatValue?.("crime", c) ?? "", state.selectedSuspectId),
    [derived, combined, state.selectedSuspectId],
  );

  const selected = state.selectedSuspectId !== null && members.some((m) => m.id === state.selectedSuspectId);
  const accuseReason = !selected
    ? ACCUSE_NEEDS_SUSPECT
    : rejected
      ? `Rule set ${state.selected} found this case unfair, so nobody can be accused.`
      : null;
  const motion = reducedMotion === undefined ? {} : { reducedMotion };

  const onAccuse = () => {
    if (state.selectedSuspectId === null) return;
    const outcome = store.accuse(state.selectedSuspectId);
    setAccuseError(outcome.ok ? null : outcome.message);
  };

  return (
    <HoveredRuleProvider>
      <ShellFrame
        heading="Bones Case Files"
        xray={state.xray}
        lightboxLabel={derived.title}
        introPhase={introPhaseFor(state.xray)}
        headerActions={<Toolbar state={state} store={store} />}
        statusNote={<VersionNote note={versionNoteText(state.selected)} />}
        {...motion}
      >
        <DocumentPanel trace={trace} anatomy={combined} source={{ kind: "text", text }} {...motion} />
        <div className="xr-shell-stagecell">
          <div className="case-center">
            <div className="case-top">
            <GlassCard
              trace={trace}
              anatomy={combined}
              overruled={rejected}
              stampDetail={state.selected}
              {...motion}
            />
            <SkeletonEnsemble
              key={`ensemble-${replayKey}`}
              trace={trace}
              members={members}
              xray={state.xray}
              selectedId={state.selectedSuspectId}
              onSelect={(id) => store.selectSuspect(id)}
              selectLabel="Choose a suspect"
              {...motion}
            />
            </div>
          </div>
        </div>
        <ControlPanel
          trace={trace}
          anatomy={combined}
          versions={VERSIONS}
          value={state.selected}
          onVersionChange={(v) => {
            if (isVersionLabel(v)) store.selectVersion(v);
          }}
          xray={state.xray}
          onXrayChange={(next) => {
            if (next !== state.xray) store.toggleXray();
          }}
          {...motion}
        />
        <div className="case-actions">
          <div className="xr-result-actions">
            <button
              type="button"
              className="xr-footer-btn"
              disabled={accuseReason !== null}
              {...(accuseReason !== null ? { "aria-describedby": "accuse-reason" } : {})}
              onClick={onAccuse}
            >
              Accuse
            </button>
            <button type="button" className="xr-footer-btn" onClick={() => setReplayKey((k) => k + 1)}>
              Replay
            </button>
          </div>
          {accuseReason !== null && (
            <p id="accuse-reason" className="xr-status case-reason">
              {accuseReason}
            </p>
          )}
          {accuseError !== null && (
            <p role="alert" className="xr-status case-reason">
              {accuseError}
            </p>
          )}
          <ErrorPanel error={state.notice === null ? null : state.notice.error} title="Replay failed" />
          <ErrorPanel error={effectiveError} title="Override could not be applied" />
        </div>
        <DoctorPanel
          key={`doctor-${replayKey}`}
          trace={trace}
          anatomy={combined}
          claimedCents={derived.suspects.length}
          speedMs={speedMs}
          extraMessages={extraMessages}
          {...(effective === null ? {} : { effective })}
          onReplay={() => setReplayKey((k) => k + 1)}
          onOverride={() => setDialogOpen(true)}
          overrideRef={overrideRef}
          {...motion}
        />
      </ShellFrame>
      <OverrideDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={(form) => store.submitOverride(form)}
        returnFocusTo={overrideRef}
      />
    </HoveredRuleProvider>
  );
}
