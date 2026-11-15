import { formatTripWindow } from "../format/dates";
import { DEFAULT_TRIP, SAMPLE_BLURBS, SAMPLE_IDS } from "../extraction/samples";
import type { SampleId } from "../extraction/samples";
import type { StartError } from "../state/reducer";
import { titlePlate } from "../state/selectors";
import { ErrorPanel } from "./ErrorPanel";

export interface StartScreenProps {
  busy: boolean;
  error: StartError | null;
  onLoadSample: (id: SampleId) => void;
}

const SAMPLE_NAMES: Record<SampleId, string> = {
  signature: "Signature case",
  clean: "Clean meal",
  "outside-window": "Outside the trip window",
};

export function StartScreen({ busy, error, onLoadSample }: StartScreenProps) {
  return (
    <section className="app-start" aria-labelledby="start-title">
      <p className="app-plate">{titlePlate(null)}</p>
      <h1 id="start-title" tabIndex={-1}>
        Expense Auditor
      </h1>
      <p className="app-lead">The AI reads the receipt. The rules decide.</p>
      <div role="group" aria-label="Load sample receipt" className="app-group">
        <div className="app-samples">
          {SAMPLE_IDS.map((id) => (
            <div key={id} className="app-sample">
              <button
                type="button"
                className="app-button"
                disabled={busy}
                aria-describedby={`sample-blurb-${id}`}
                onClick={() => onLoadSample(id)}
              >
                {SAMPLE_NAMES[id]}
              </button>
              <p id={`sample-blurb-${id}`} className="app-blurb">
                {SAMPLE_BLURBS[id]}
              </p>
            </div>
          ))}
        </div>
      </div>
      <p className="app-trip">{formatTripWindow(DEFAULT_TRIP)}</p>
      {busy ? (
        <p role="status" className="app-status">
          Reading receipt
        </p>
      ) : null}
      <ErrorPanel error={error} />
    </section>
  );
}
