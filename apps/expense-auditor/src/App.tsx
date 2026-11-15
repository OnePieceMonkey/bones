import { Component, useEffect, useRef } from "react";
import type { ErrorInfo, ReactNode } from "react";
import type { CoreError } from "@bones/core";
import { useSession } from "./state/sessionStore";
import type { SessionStore } from "./state/sessionStore";
import { DecisionView } from "./ui/DecisionView";
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
        <main>
          <p role="alert" className="app-error">
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
  const mainRef = useRef<HTMLElement>(null);
  const previous = useRef(state.screen);
  useEffect(() => {
    if (previous.current === state.screen) return;
    previous.current = state.screen;
    mainRef.current?.querySelector("h1")?.focus();
  }, [state.screen]);
  return (
    <main ref={mainRef}>
      {state.screen === "start" ? (
        <StartScreen busy={state.busy} error={state.error} onLoadSample={(id) => void store.loadSample(id)} />
      ) : (
        <DecisionView key={state.sessionId} state={state} store={store} />
      )}
    </main>
  );
}

export function App({ store = null, bundleError = null }: AppProps) {
  return (
    <ErrorBoundary>
      {store === null ? (
        <main>
          <h1>Expense Auditor</h1>
          <ErrorPanel error={bundleError} title="The rules could not be loaded" />
        </main>
      ) : (
        <Screens store={store} />
      )}
    </ErrorBoundary>
  );
}
