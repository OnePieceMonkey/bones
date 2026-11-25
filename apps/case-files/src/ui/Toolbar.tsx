import { HeaderAction, IconDownload, IconLoad } from "@bones/xray-ui";
import { downloadText, exportFileName, exportTrace } from "../export/exportTrace";
import type { CaseState } from "../state/reducer";
import type { SessionStore } from "../state/sessionStore";
import { displayedTrace } from "../state/selectors";
export interface ToolbarProps {
  state: CaseState;
  store: SessionStore;
  /** Injected in tests; defaults to the browser download helper. */
  download?: (name: string, text: string) => void;
}
export function Toolbar({ state, store, download = downloadText }: ToolbarProps) {
  return (
    <div role="toolbar" aria-label="Case actions" className="app-toolbar">
      <HeaderAction
        icon={<IconDownload />}
        onClick={() => {
          const trace = displayedTrace(state);
          download(exportFileName(trace), exportTrace(trace, state.overrides, state.accusation));
        }}
      >
        Download trace
      </HeaderAction>
      <HeaderAction icon={<IconLoad />} onClick={() => store.reset()}>Load another case</HeaderAction>
    </div>
  );
}
