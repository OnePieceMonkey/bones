import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isCoreError } from "@bones/core";
import "@bones/xray-ui";
import "./styles/app.css";
import { App } from "./App";
import { createProductionSession } from "./state/sessionStore";
const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");
const session = createProductionSession();
createRoot(container).render(
  <StrictMode>
    {isCoreError(session) ? <App store={null} bundleError={session} /> : <App store={session} />}
  </StrictMode>,
);
