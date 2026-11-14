import { StrictMode, useCallback, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { XrayView } from "../src/components/XrayView";
import type { FilmSource } from "../src/types";
import "../src/styles/tokens.css";
import "../src/styles/xray.css";
import { demoAnatomy } from "./anatomy";
import { VERSIONS, buildTrace } from "./demoTrace";
import type { DemoVersion } from "./demoTrace";

const FILM_LINES: string[] = [
  "RESTAURANT ZUM ANKER",
  "Date: 2024-03-15",
  "Business dinner, 8 guests",
  "Food and soft drinks   41.50",
  "Wine                    6.50",
  "Total                 480.00",
];

const source: FilmSource = { kind: "text", text: FILM_LINES.join("\n") };

function Demo() {
  const [version, setVersion] = useState<DemoVersion>("v1");
  const [replayKey, setReplayKey] = useState(0);
  const trace = useMemo(() => buildTrace(version), [version]);

  const handleVersionChange = useCallback((next: string): void => {
    const found = VERSIONS.find((v) => v === next);
    if (found !== undefined) setVersion(found);
  }, []);
  const handleReplay = useCallback((): void => setReplayKey((k) => k + 1), []);

  return (
    <XrayView
      key={replayKey}
      title="Expense receipt"
      trace={trace}
      anatomy={demoAnatomy}
      source={source}
      versions={[...VERSIONS]}
      version={version}
      onVersionChange={handleVersionChange}
      onReplay={handleReplay}
    />
  );
}

const container = document.getElementById("root");
if (container === null) throw new Error("missing #root");
createRoot(container).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
