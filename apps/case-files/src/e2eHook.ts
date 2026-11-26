import type { RecordedCaseId } from "./extraction/samples";
import type { SessionStore } from "./state/sessionStore";
declare global {
  interface Window {
    __caseFilesE2E?: { loadRecordedCase: (id: RecordedCaseId) => Promise<void> };
  }
}
/** e2e build only: lets a spec open the 4-suspect fixture that no start screen sheet lists. */
export function installE2eHook(store: SessionStore): void {
  window.__caseFilesE2E = { loadRecordedCase: (id) => store.loadRecordedCase(id) };
}
