import type { CoreError } from "@bones/core";
import type { StartError } from "../state/reducer";
export interface ErrorDescription {
  summary: string;
  details: string[];
}
/** Pure, plain-English description of a CoreError. Never includes stack traces or raw model output. */
export function describeError(e: CoreError): ErrorDescription {
  switch (e.kind) {
    case "validation_failed":
      return {
        summary: "The case text is missing fields or breaks a limit, so it was rejected.",
        details: e.fieldErrors.map((f) => `${f.path}: ${f.issue}`),
      };
    case "extraction_failed":
      switch (e.reason) {
        case "disabled":
          return { summary: "Live mode is off on this server. Pick a recorded case.", details: [] };
        case "network":
          return {
            summary: "The case service could not be reached. Check your connection and try again.",
            details: [],
          };
        case "bad_response":
          return {
            summary: "The case service returned an answer this app cannot trust, so it was rejected.",
            details: [],
          };
        case "upstream":
          return { summary: "The case service failed or refused the request. Try again later.", details: [] };
      }
      return { summary: e.message, details: [] };
    case "fixture_not_found":
    case "fixture_invalid":
      return { summary: "The recorded case could not be loaded.", details: [] };
    case "input_empty":
      return { summary: "The input is empty.", details: [] };
    case "input_too_large":
      return { summary: "The input is too large.", details: [] };
    case "invalid_replay_arguments":
      if (e.missingField === "hasher") {
        return {
          summary: "This page cannot compute fingerprints here. Open it over HTTPS or on localhost.",
          details: [],
        };
      }
      return { summary: e.message, details: [] };
    default:
      return { summary: e.message, details: [] };
  }
}
export interface ErrorPanelProps {
  error: StartError | CoreError | null;
  title?: string;
}
function isStartError(e: StartError | CoreError): e is StartError {
  return e.kind === "core";
}
export function ErrorPanel({ error, title }: ErrorPanelProps) {
  if (error === null) return null;
  const core: CoreError = isStartError(error) ? error.error : error;
  const { summary } = describeError(core);
  const items = core.kind === "validation_failed" ? core.fieldErrors : [];
  return (
    <div role="alert" className="xr-error">
      <h2>{title ?? "This case cannot be opened"}</h2>
      <p>{summary}</p>
      {items.length > 0 ? (
        <ul>
          {items.map((it, i) => (
            <li key={`${it.path}-${i}`}>
              <code>{it.path}</code>
              <span>: {it.issue}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
