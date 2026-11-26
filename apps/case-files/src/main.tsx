import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isCoreError } from "@bones/core";
import "@bones/xray-ui";
import "./styles/app.css";
import { App } from "./App";
import { installE2eHook } from "./e2eHook";
import { createProductionSession } from "./state/sessionStore";
const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");
const session = createProductionSession();
if (__CASE_FILES_E2E__ && !isCoreError(session)) installE2eHook(session);
createRoot(container).render(
  <StrictMode>
    {isCoreError(session) ? <App store={null} bundleError={session} /> : <App store={session} />}
  </StrictMode>,
);
