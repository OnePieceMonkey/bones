import type { RefObject } from "react";
import { buildExport, downloadText, exportFileName, serializeExport } from "../export/exportTrace";
import type { DecisionState } from "../state/reducer";
import type { SessionStore } from "../state/sessionStore";
import { displayedTrace } from "../state/selectors";

export interface ToolbarProps {
  state: DecisionState;
  store: SessionStore;
  onOverrule: () => void;
  overruleRef: RefObject<HTMLButtonElement>;
  /** Injected in tests; defaults to the browser download helper. */
  download?: (name: string, text: string) => void;
}

export function Toolbar({ state, store, onOverrule, overruleRef, download = downloadText }: ToolbarProps) {
  return (
    <div role="toolbar" aria-label="Decision actions" className="app-toolbar">
      <button type="button" className="app-button" ref={overruleRef} onClick={onOverrule}>
        Overrule
      </button>
      <button
        type="button"
        className="app-button"
        onClick={() =>
          download(exportFileName(displayedTrace(state)), serializeExport(buildExport(state)))
        }
      >
        Download trace
      </button>
      <button type="button" className="app-button" onClick={() => store.reset()}>
        Load another receipt
      </button>
    </div>
  );
}
