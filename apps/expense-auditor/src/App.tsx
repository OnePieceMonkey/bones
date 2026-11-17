import { Component, useEffect, useRef } from "react";
import type { ErrorInfo, ReactNode } from "react";
import type { CoreError } from "@bones/core";
import { prepareImage } from "./extraction/imageResize";
import { useSession } from "./state/sessionStore";
import type { SessionStore } from "./state/sessionStore";
import { DecisionView } from "./ui/DecisionView";
import { ErrorPanel } from "./ui/ErrorPanel";
import { StartScreen } from "./ui/StartScreen";

export interface AppProps {
  /** True when the server reports live reading (task 22.11 wires the check). */
  liveAvailable?: boolean;
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

function Screens({ store, liveAvailable }: { store: SessionStore; liveAvailable: boolean }) {
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
        <StartScreen
          busy={state.busy}
          error={state.error}
          onLoadSample={(id) => void store.loadSample(id)}
          liveAvailable={liveAvailable}
          onLoadPhoto={(request) => void store.loadPhoto(request)}
          prepare={(file) => prepareImage(file)}
        />
      ) : (
        <DecisionView key={state.sessionId} state={state} store={store} />
      )}
    </main>
  );
}

export function App({ store = null, bundleError = null, liveAvailable = false }: AppProps) {
  return (
    <ErrorBoundary>
      {store === null ? (
        <main>
          <h1>Expense Auditor</h1>
          <ErrorPanel error={bundleError} title="The rules could not be loaded" />
        </main>
      ) : (
        <Screens store={store} liveAvailable={liveAvailable} />
      )}
    </ErrorBoundary>
  );
}
