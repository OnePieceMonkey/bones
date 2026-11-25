import type { AccusationRecord } from "../state/accusation";
import { renderAccusationText, renderBannerList } from "../solver/solverMessages";
import type { NameMap } from "../solver/solverMessages";

/**
 * Banner wording (requirement 11.9): the prefix is upper case ("CASE CLOSED:", "WRONG SUSPECT:").
 * The sentence comes from the closed template in `solverMessages.ts`; only its prefix is upper-cased
 * here, so the Dr. Bones chat text ("Case closed: ...") stays unchanged.
 */
export function bannerText(record: Pick<AccusationRecord, "suspectId" | "verdict">, names: NameMap): string {
  const sentence = renderAccusationText(record, names);
  const cut = sentence.indexOf(":");
  return cut < 0 ? sentence : `${sentence.slice(0, cut).toUpperCase()}${sentence.slice(cut)}`;
}

/** What another rule set version says about the accused suspect, or `null` when nothing differs. */
export interface DisplayedStanding {
  version: string;
  /** The displayed version found the whole case unfair (Trace result rejected). */
  unfair: boolean;
  /** The accused suspect is in `convictable` under the displayed version. */
  convictable: boolean;
}

/** Closed template note for requirement 11.10. Never reads model text. */
export function verdictNote(
  record: Pick<AccusationRecord, "suspectId" | "verdict">,
  /** Label ("v1", "v2", "v3") of the version that was accused under. */
  accusedLabel: string,
  standing: DisplayedStanding | null,
  names: NameMap,
): string | null {
  if (standing === null || standing.version === accusedLabel) return null;
  const name = names.get(record.suspectId) ?? record.suspectId;
  const tail = `Your accusation under ${accusedLabel} stays on record.`;
  if (standing.unfair) {
    return `Under ${standing.version} this case is unfair, so ${name} could not be accused. ${tail}`;
  }
  const same = standing.convictable === (record.verdict === "correct");
  if (same) return null;
  return `Under ${standing.version}, ${name} ${standing.convictable ? "can" : "cannot"} be convicted. ${tail}`;
}

export interface ResultBannerProps {
  record: AccusationRecord;
  names: NameMap;
  /** Suspects the Solver found convictable under the accused version. */
  convictable: readonly string[];
  note: string | null;
}

export function ResultBanner({ record, names, convictable, note }: ResultBannerProps) {
  const correct = record.verdict === "correct";
  return (
    <div className="case-banner" role="status" data-verdict={record.verdict}>
      <p className="xr-result">
        <span className="xr-result-icon" aria-hidden="true">
          {correct ? "✓" : "✕"}
        </span>
        <span className="xr-result-label">{bannerText(record, names)}</span>
      </p>
      <p className="xr-status">{renderBannerList(convictable, names)}</p>
      {note !== null && <p className="xr-status case-note">{note}</p>}
    </div>
  );
}
