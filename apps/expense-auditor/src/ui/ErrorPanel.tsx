import type { CoreError } from "@bones/core";
import { anatomy } from "../anatomy";
import type { StartError } from "../state/reducer";

export interface ErrorDescription {
  summary: string;
  details: string[];
}

/** Plain label for a field path such as `lineItems[0].amount`; `null` when unknown. */
function labelFor(path: string): string | null {
  const labels = anatomy.fieldLabels as Record<string, string>;
  const exact = labels[path];
  if (exact !== undefined) return exact;
  const root = path.split(/[.[]/)[0] ?? path;
  return labels[root] ?? null;
}

function fieldLine(path: string, issue: string): string {
  const label = labelFor(path);
  return label === null ? `${path}: ${issue}` : `${label} (${path}): ${issue}`;
}

/** Pure, plain-English description of a CoreError. Never includes stack traces or raw model output. */
export function describeError(e: CoreError): ErrorDescription {
  switch (e.kind) {
    case "validation_failed":
      return {
        summary: "The AI read the receipt, but some fields are missing or not valid.",
        details: e.fieldErrors.map((f) => fieldLine(f.path, f.issue)),
      };
    case "extraction_failed":
      switch (e.reason) {
        case "disabled":
          return { summary: "Live reading is switched off on this server.", details: [] };
        case "network":
          return {
            summary: "The reading service could not be reached. Check your connection and try again.",
            details: [],
          };
        case "bad_response":
          return {
            summary: "The reading service returned an answer this app cannot trust, so it was rejected.",
            details: [],
          };
        case "upstream":
          return {
            summary: "The reading service failed or refused the request. Try again later.",
            details: [],
          };
      }
      return { summary: e.message, details: [] };
    case "fixture_not_found":
    case "fixture_invalid":
      return { summary: "The recorded receipt could not be loaded.", details: [] };
    case "input_empty":
      return { summary: "The file is empty.", details: [] };
    case "input_too_large":
      return { summary: "The file is too large.", details: [] };
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
  return e.kind === "core" || e.kind === "upload";
}

export function ErrorPanel({ error, title }: ErrorPanelProps) {
  if (error === null) return null;
  let summary: string;
  let items: { label: string | null; path: string; issue: string }[] = [];
  let core: CoreError | null = null;
  if (isStartError(error)) {
    if (error.kind === "upload") {
      summary = error.problem.message;
    } else {
      core = error.error;
      summary = describeError(core).summary;
    }
  } else {
    core = error;
    summary = describeError(core).summary;
  }
  if (core !== null && core.kind === "validation_failed") {
    items = core.fieldErrors.map((f) => ({ label: labelFor(f.path), path: f.path, issue: f.issue }));
  }
  return (
    <div role="alert" className="app-error">
      <h2>{title ?? "This receipt cannot be decided"}</h2>
      <p>{summary}</p>
      {items.length > 0 ? (
        <ul>
          {items.map((it, i) => (
            <li key={`${it.path}-${i}`}>
              {it.label === null ? (
                <code>{it.path}</code>
              ) : (
                <>
                  <span>{it.label} (</span>
                  <code>{it.path}</code>
                  <span>)</span>
                </>
              )}
              <span>: {it.issue}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
