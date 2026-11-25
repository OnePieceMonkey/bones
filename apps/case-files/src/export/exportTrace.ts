import type { Override, Trace } from "@bones/core";
import type { AccusationRecord } from "../state/accusation";

export interface CaseExportFile {
  format: "bones.case-files.export";
  formatVersion: 1;
  trace: Trace;
  overrides: Override[];
  accusation: AccusationRecord | null;
}

/** Pure. The Trace, its overrides (order kept) and the Accusation_Record, or `null`. */
export function buildCaseExport(
  trace: Trace,
  overrides: readonly Override[],
  accusation: AccusationRecord | null,
): CaseExportFile {
  return {
    format: "bones.case-files.export",
    formatVersion: 1,
    trace,
    overrides: [...overrides],
    accusation,
  };
}

export function serializeExport(f: CaseExportFile): string {
  return JSON.stringify(f, null, 2);
}

/** Serialises the Trace, the overrides and the accusation record to JSON text. */
export function exportTrace(
  trace: Trace,
  overrides: readonly Override[],
  accusation: AccusationRecord | null,
): string {
  return serializeExport(buildCaseExport(trace, overrides, accusation));
}

export function exportFileName(trace: Trace): string {
  return `case-trace-${trace.decisionId.slice(0, 8)}.json`;
}

export interface DownloadAnchor {
  href: string;
  download: string;
  click(): void;
  remove?(): void;
}

export interface DownloadEnv {
  createBlob(text: string): Blob;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  createAnchor(): DownloadAnchor;
  appendAnchor?(a: DownloadAnchor): void;
}

function browserEnv(): DownloadEnv {
  return {
    createBlob: (text) => new Blob([text], { type: "application/json" }),
    createObjectURL: (b) => URL.createObjectURL(b),
    revokeObjectURL: (u) => URL.revokeObjectURL(u),
    createAnchor: () => document.createElement("a"),
    appendAnchor: (a) => document.body.appendChild(a as unknown as Node),
  };
}

/** Client-side download through a Blob and a temporary anchor. No network call. Never throws. */
export function downloadText(name: string, text: string, env?: DownloadEnv): void {
  let url: string | null = null;
  let e: DownloadEnv | null = null;
  try {
    e = env ?? browserEnv();
    url = e.createObjectURL(e.createBlob(text));
    const a = e.createAnchor();
    a.href = url;
    a.download = name;
    e.appendAnchor?.(a);
    a.click();
    a.remove?.();
  } catch {
    // Download is best effort.
  }
  if (url !== null && e !== null) {
    try {
      e.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
}
