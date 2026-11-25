import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import type { CoreError } from "@bones/core";
import { useSession } from "./state/sessionStore";
import type { SessionStore } from "./state/sessionStore";
import { ErrorPanel } from "./ui/ErrorPanel";
import { StartScreen } from "./ui/StartScreen";
export interface AppProps {
  store?: SessionStore | null;
  /** Set when the rule bundle failed to load. */
  bundleError?: CoreError | null;
}
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(_error: Error, _info: ErrorInfo): void {}
  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="xr-app">
          <p role="alert" className="xr-error">
            Something went wrong. Reload the page.
          </p>
        </main>
      );
    }
    return this.props.children;
  }
}
function Screens({ store }: { store: SessionStore }) {
  const state = useSession(store);
  return (
    <main className="xr-app">
      {state.screen === "start" ? (
        <StartScreen
          busy={state.busy}
          error={state.error}
          onLoadCase={(id) => void store.loadRecordedCase(id)}
          liveAvailable={false}
        />
      ) : (
        // The case screen arrives in task 6.3.
        <p role="status" className="xr-status">
          Case open: {state.origin.kind === "recorded" ? state.origin.caseId : state.origin.theme}
        </p>
      )}
    </main>
  );
}
export function App({ store = null, bundleError = null }: AppProps) {
  return (
    <ErrorBoundary>
      {store === null ? (
        <main className="xr-app">
          <h1>Bones Case Files</h1>
          <ErrorPanel error={bundleError} title="The rules could not be loaded" />
        </main>
      ) : (
        <Screens store={store} />
      )}
    </ErrorBoundary>
  );
}
