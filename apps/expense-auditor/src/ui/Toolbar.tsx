import { HeaderAction } from "@bones/xray-ui";
import { buildExport, downloadText, exportFileName, serializeExport } from "../export/exportTrace";
import type { DecisionState } from "../state/reducer";
import type { SessionStore } from "../state/sessionStore";
import { displayedTrace } from "../state/selectors";

export interface ToolbarProps {
  state: DecisionState;
  store: SessionStore;
  /** Injected in tests; defaults to the browser download helper. */
  download?: (name: string, text: string) => void;
}

export function Toolbar({ state, store, download = downloadText }: ToolbarProps) {
  return (
    <div role="toolbar" aria-label="Decision actions" className="app-toolbar">
      <HeaderAction
        onClick={() =>
          download(exportFileName(displayedTrace(state)), serializeExport(buildExport(state)))
        }
      >
        Download trace
      </HeaderAction>
      <HeaderAction onClick={() => store.reset()}>Load another receipt</HeaderAction>
    </div>
  );
}
