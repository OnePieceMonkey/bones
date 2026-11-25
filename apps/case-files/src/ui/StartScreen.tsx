import { useState } from "react";
import type { FormEvent } from "react";
import { FilmSheet, FormStrip, FormStripField, ShellFrame, StartHeadline, StartLayout } from "@bones/xray-ui";
import { RECORDED_CASES, recordedSheetList } from "../extraction/samples";
import type { RecordedCaseId } from "../extraction/samples";
import type { StartError, Theme } from "../state/reducer";
import { ErrorPanel } from "./ErrorPanel";
export interface StartScreenProps {
  busy: boolean;
  error: StartError | null;
  onLoadCase: (id: RecordedCaseId) => void;
  /** True when the server reports live mode. No live code exists yet, so the App passes false. */
  liveAvailable?: boolean;
  onWriteCase?: (theme: Theme) => void;
  /** The stored recorded entries (unvalidated); defaults to the bundled ones. */
  cases?: readonly unknown[];
  /** Forces the xray-ui motion mode; absent means follow the media query. */
  reducedMotion?: boolean;
}
export const THEMES: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: "manor", label: "Country manor" },
  { value: "train", label: "Night train" },
  { value: "university", label: "University" },
  { value: "lighthouse", label: "Lighthouse" },
];
export const LIVE_OFF_NOTE = "Live mode is off on this server. Pick a recorded case.";
export const RECORDED_NOTE = "Recorded demo case";
const LINE_WIDTH = 22;
function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
/** Greedy word wrap into at most `rows` lines of `width` characters; the last line is clipped. */
function wrap(text: string, width: number, rows: number): string[] {
  const out: string[] = [];
  let line = "";
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  for (const [i, word] of words.entries()) {
    if (line.length > 0 && line.length + 1 + word.length > width) {
      if (out.length === rows - 1) return [...out, clip([line, ...words.slice(i)].join(" "), width)];
      out.push(line);
      line = word;
    } else {
      line = line.length === 0 ? word : `${line} ${word}`;
    }
  }
  if (line.length > 0) out.push(clip(line, width));
  return out;
}
interface SheetInfo {
  id: RecordedCaseId;
  title: string;
  description: string;
  lines: string[];
}
/** Sheet data built from the stored case fields only (title, suspect count, setting). */
export function sheetInfos(cases: readonly unknown[]): SheetInfo[] {
  return recordedSheetList(cases).map(({ id, title }) => {
    const entry = cases.find((c) => (c as { id?: unknown } | null)?.id === id) as
      | { extraction?: { proposedFields?: { setting?: unknown; suspects?: unknown } } }
      | undefined;
    const fields = entry?.extraction?.proposedFields;
    const setting = typeof fields?.setting === "string" ? fields.setting : "";
    const count = Array.isArray(fields?.suspects) ? fields.suspects.length : 0;
    const suspects = `${count} ${count === 1 ? "suspect" : "suspects"}`;
    return {
      id,
      title,
      description: clip(setting === "" ? suspects : setting, 66),
      lines: [clip(title, LINE_WIDTH), suspects, ...wrap(setting, LINE_WIDTH, 2)],
    };
  });
}
export function StartScreen({
  busy,
  error,
  onLoadCase,
  liveAvailable = false,
  onWriteCase,
  cases = RECORDED_CASES,
  reducedMotion,
}: StartScreenProps) {
  const [picked, setPicked] = useState<RecordedCaseId | null>(null);
  const [theme, setTheme] = useState<Theme>("manor");
  const motion = reducedMotion === undefined ? {} : { reducedMotion };
  const writeEnabled = liveAvailable && onWriteCase !== undefined && !busy;
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (writeEnabled) onWriteCase(theme);
  }
  return (
    <>
      <ShellFrame heading="Bones Case Files" xray lightboxLabel="Case Files - RECORDED" {...motion}>
        <StartLayout formShown>
          <StartHeadline
            title="Pick a case to X-ray."
            subtitle="The AI writes the case. The rules decide who can be convicted."
          />
          <div role="group" aria-label="Load recorded case" className="xr-start-row">
            {sheetInfos(cases).map((s) => (
              <FilmSheet
                key={s.id}
                id={`case-${s.id}`}
                title={s.title}
                description={s.description}
                lines={s.lines}
                note={RECORDED_NOTE}
                disabled={busy}
                selected={busy && picked === s.id}
                onSelect={() => {
                  if (busy) return;
                  setPicked(s.id);
                  onLoadCase(s.id);
                }}
                {...motion}
              />
            ))}
          </div>
          <form onSubmit={onSubmit} className="app-live-form">
            <FormStrip legend="Write a new case" disabled={!writeEnabled}>
              <FormStripField label="Theme">
                <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
                  {THEMES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </FormStripField>
              <button type="submit">Write case</button>
              {liveAvailable ? null : <span className="xr-form-strip-field">{LIVE_OFF_NOTE}</span>}
            </FormStrip>
          </form>
        </StartLayout>
        {busy ? (
          <p role="status" className="xr-status app-status">
            Opening case
          </p>
        ) : null}
      </ShellFrame>
      <ErrorPanel error={error} />
    </>
  );
}
