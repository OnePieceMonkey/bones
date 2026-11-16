import { useState } from "react";
import { FilmSheet, ShellFrame } from "@bones/xray-ui";
import { SAMPLE_FILM_LINES, SAMPLE_IDS } from "../extraction/samples";
import type { SampleId } from "../extraction/samples";
import type { StartError } from "../state/reducer";
import { ErrorPanel } from "./ErrorPanel";

export interface StartScreenProps {
  busy: boolean;
  error: StartError | null;
  onLoadSample: (id: SampleId) => void;
  /** Forces the xray-ui motion mode; absent means follow the media query. */
  reducedMotion?: boolean;
}

const SAMPLE_NAMES: Record<SampleId, string> = {
  signature: "Signature case",
  clean: "Clean meal",
  "outside-window": "Outside the trip window",
};

export function StartScreen({ busy, error, onLoadSample, reducedMotion }: StartScreenProps) {
  const [picked, setPicked] = useState<SampleId | null>(null);
  const motion = reducedMotion === undefined ? {} : { reducedMotion };
  return (
    <>
      <ShellFrame heading="Expense Auditor" xray lightboxLabel="Load sample receipt" {...motion}>
        <div role="group" aria-label="Load sample receipt" className="app-sheets">
          {SAMPLE_IDS.map((id) => (
            <FilmSheet
              key={id}
              id={`sample-${id}`}
              title={SAMPLE_NAMES[id]}
              description={SAMPLE_FILM_LINES[id]}
              disabled={busy}
              selected={busy && picked === id}
              onSelect={() => {
                if (busy) return;
                setPicked(id);
                onLoadSample(id);
              }}
              {...motion}
            />
          ))}
        </div>
        {busy ? (
          <p role="status" className="app-status">
            Reading receipt
          </p>
        ) : null}
      </ShellFrame>
      <ErrorPanel error={error} />
    </>
  );
}
