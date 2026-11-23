import { useState } from "react";
import type { FormEvent } from "react";
import { FilmSheet, FormStrip, FormStripField, FormStripFile, ShellFrame, StartHeadline, StartLayout } from "@bones/xray-ui";
import { DEFAULT_TRIP } from "../extraction/samples";
import type { PreparedImage } from "../extraction/imageResize";
import type { PhotoRequest } from "../state/sessionStore";
import { SAMPLE_FILM_LINES, SAMPLE_IDS, sampleThumbLines } from "../extraction/samples";
import type { SampleId } from "../extraction/samples";
import type { StartError, UploadProblem } from "../state/reducer";
import { ErrorPanel } from "./ErrorPanel";

export interface StartScreenProps {
  busy: boolean;
  error: StartError | null;
  onLoadSample: (id: SampleId) => void;
  /** True when the server reports live reading; renders the photo controls. */
  liveAvailable?: boolean;
  onLoadPhoto?: (request: PhotoRequest) => void;
  /** Prepares the chosen file (type check, shrink). Wired to `prepareImage` by the App. */
  prepare?: (file: File) => Promise<PreparedImage | UploadProblem>;
  /** Forces the xray-ui motion mode; absent means follow the media query. */
  reducedMotion?: boolean;
}

const SAMPLE_NAMES: Record<SampleId, string> = {
  signature: "Signature case",
  clean: "Clean meal",
  "outside-window": "Outside the trip window",
};

function isProblem(r: PreparedImage | UploadProblem): r is UploadProblem {
  return "reason" in r;
}

export function StartScreen({
  busy,
  error,
  onLoadSample,
  liveAvailable = false,
  onLoadPhoto,
  prepare,
  reducedMotion,
}: StartScreenProps) {
  const [picked, setPicked] = useState<SampleId | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [tripStart, setTripStart] = useState<string>(DEFAULT_TRIP.start);
  const [tripEnd, setTripEnd] = useState<string>(DEFAULT_TRIP.end);
  const [problem, setProblem] = useState<UploadProblem | null>(null);
  const [preparing, setPreparing] = useState(false);
  const live = liveAvailable && file !== null;
  const label = liveAvailable
    ? `Expense Auditor - ${live ? "LIVE" : "RECORDED"}`
    : "Load sample receipt";

  function onFile(next: File | null) {
    setProblem(null);
    if (next !== null && next.type !== "image/jpeg" && next.type !== "image/png") {
      setFile(null);
      setProblem({ reason: "type", message: "Choose a JPEG or PNG photo." });
      return;
    }
    setFile(next);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (file === null || busy || preparing || onLoadPhoto === undefined || prepare === undefined) return;
    setProblem(null);
    setPreparing(true);
    try {
      const result = await prepare(file);
      if (isProblem(result)) {
        setProblem(result);
        return;
      }
      onLoadPhoto({ image: result, fileName: file.name, trip: { start: tripStart, end: tripEnd } });
    } finally {
      setPreparing(false);
    }
  }

  const motion = reducedMotion === undefined ? {} : { reducedMotion };
  return (
    <>
      <ShellFrame heading="Expense Auditor" xray lightboxLabel={label} {...motion}>
        <StartLayout formShown={liveAvailable}>
          <StartHeadline
            title="Pick a receipt to X-ray."
            subtitle="The AI reads the receipt. The rules decide."
          />
          {liveAvailable ? (
            <form onSubmit={(e) => void onSubmit(e)} className="app-live-form">
              <FormStrip legend="Live receipt photo" disabled={busy || preparing}>
                <FormStripFile
                  label="Upload receipt photo"
                  accept="image/jpeg,image/png"
                  placeholder="Choose a photo"
                  onFile={onFile}
                />
                <FormStripField label="Trip start">
                  <input type="date" required value={tripStart} onChange={(e) => setTripStart(e.target.value)} />
                </FormStripField>
                <FormStripField label="Trip end">
                  <input type="date" required value={tripEnd} onChange={(e) => setTripEnd(e.target.value)} />
                </FormStripField>
                <button type="submit" disabled={file === null}>
                  Read receipt
                </button>
              </FormStrip>
            </form>
          ) : null}
          <div role="group" aria-label="Load sample receipt" className="xr-start-row">
            {SAMPLE_IDS.map((id) => (
              <FilmSheet
                key={id}
                id={`sample-${id}`}
                title={SAMPLE_NAMES[id]}
                description={SAMPLE_FILM_LINES[id]}
                lines={sampleThumbLines(id)}
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
        </StartLayout>
        {busy ? (
          <p role="status" className="xr-status app-status">
            Reading receipt
          </p>
        ) : null}
      </ShellFrame>
      <ErrorPanel error={problem !== null ? { kind: "upload", problem } : error} />
    </>
  );
}
