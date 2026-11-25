import { useMemo, useState } from "react";
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
import type { RuleBundle, VersionLabel } from "../rules/catalog";
import { solve } from "../solver/solve";
import { buildSolverMessages } from "../solver/solverMessages";
import type { AccusationRecord } from "../state/accusation";
import { introPhaseFor } from "../state/intro";
import type { CaseState } from "../state/reducer";
import { displayedTrace, effectiveView } from "../state/selectors";
import type { SessionStore } from "../state/sessionStore";
import { caseDocumentText, chatSpeedMs } from "./CaseScreen";
import { ErrorPanel } from "./ErrorPanel";
import { ResultBanner, verdictNote } from "./ResultBanner";
import type { DisplayedStanding } from "./ResultBanner";
import { Toolbar } from "./Toolbar";
import { VersionNote, versionNoteText } from "./VersionNote";

export interface VerdictViewProps {
  state: CaseState;
  /** The Accusation_Record; the view shows it unchanged whatever version is displayed. */
  accusation: AccusationRecord;
  store: SessionStore;
  bundle?: RuleBundle;
  reducedMotion?: boolean;
}

const VERSIONS: string[] = [...VERSION_LABELS];

export function VerdictView({ state, accusation, store, bundle, reducedMotion }: VerdictViewProps) {
  const [replayKey, setReplayKey] = useState(0);
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
        accused: s.id === accusation.suspectId,
      })),
    [derived, combined, accusation.suspectId],
  );
  const names = useMemo(() => new Map(derived.suspects.map((s) => [s.id, s.name] as const)), [derived]);

  const view = effectiveView(state);
  const effective: EffectiveResult | null = view !== null && !isCoreError(view) ? view : null;
  const rejected = (effective?.result ?? trace.result) === "rejected";

  // The banner list belongs to the version that was accused.
  const accusedLabel: VersionLabel =
    VERSION_LABELS.find((l) => {
      const t = l === "v1" ? state.original : state.replays[l];
      return t !== undefined && t.ruleSetId === trace.ruleSetId && t.ruleSetVersion === accusation.ruleSetVersion;
    }) ?? "v1";
  const accusedTrace = accusedLabel === "v1" ? state.original : (state.replays[accusedLabel] ?? state.original);
  const convictableAtAccusation = useMemo(() => {
    if (isCoreError(rules)) return [];
    const solved = solve(accusedTrace.validatedFields as unknown as DerivedCase, accusedLabel, rules);
    return isCoreError(solved) ? [] : solved.convictable;
  }, [rules, accusedTrace, accusedLabel]);

  const displayedSolve = useMemo(
    () => (isCoreError(rules) ? null : solve(derived, state.selected, rules)),
    [rules, derived, state.selected],
  );
  const standing: DisplayedStanding | null =
    displayedSolve === null || isCoreError(displayedSolve)
      ? null
      : {
          version: state.selected,
          unfair: displayedSolve.verdict !== "accepted",
          convictable: displayedSolve.convictable.includes(accusation.suspectId),
        };
  const note = verdictNote(accusation, accusedLabel, standing, names);

  const extraMessages = useMemo<ChatMessage[]>(
    () =>
      displayedSolve === null || isCoreError(displayedSolve)
        ? []
        : buildSolverMessages(displayedSolve, accusation, names),
    [displayedSolve, accusation, names],
  );
  const speedMs = useMemo(
    () => chatSpeedMs([...buildChatMessages(trace, combined), ...extraMessages]),
    [trace, combined, extraMessages],
  );
  const text = useMemo(
    () => caseDocumentText(derived, (c) => combined.formatValue?.("crime", c) ?? "", state.selectedSuspectId),
    [derived, combined, state.selectedSuspectId],
  );
  const motion = reducedMotion === undefined ? {} : { reducedMotion };

  return (
    <HoveredRuleProvider>
      <ShellFrame
        heading="Bones Case Files"
        xray
        lightboxLabel={derived.title}
        introPhase={introPhaseFor(true)}
        headerActions={<Toolbar state={state} store={store} />}
        statusNote={<VersionNote note={versionNoteText(state.selected)} />}
        {...motion}
      >
        <DocumentPanel trace={trace} anatomy={combined} source={{ kind: "text", text }} {...motion} />
        <div className="xr-shell-stagecell">
          <div className="case-center">
            <div className="case-top case-top-verdict">
              <GlassCard
                trace={trace}
                anatomy={combined}
                overruled={rejected}
                stampDetail={state.selected}
                {...motion}
              />
              <ResultBanner record={accusation} names={names} convictable={convictableAtAccusation} note={note} />
              <SkeletonEnsemble
                key={`ensemble-${replayKey}`}
                trace={trace}
                members={members}
                xray
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
          xray
          onXrayChange={() => {
            /* X-RAY stays on in the verdict view. */
          }}
          {...motion}
        />
        <div className="case-actions">
          <div className="xr-result-actions">
            <button type="button" className="xr-footer-btn" onClick={() => setReplayKey((k) => k + 1)}>
              Replay
            </button>
            <button type="button" className="xr-footer-btn" onClick={() => store.reset()}>
              New case
            </button>
          </div>
          <ErrorPanel error={state.notice === null ? null : state.notice.error} title="Replay failed" />
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
          {...motion}
        />
      </ShellFrame>
    </HoveredRuleProvider>
  );
}
