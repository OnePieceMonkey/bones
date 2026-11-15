import type { Override, Trace } from "@bones/core";
import type { DecisionState } from "../state/reducer";
import { displayedTrace, linkedOverrides } from "../state/selectors";

export interface ExportFile {
  format: "bones.expense-auditor.export";
  formatVersion: 1;
  trace: Trace;
  overrides: Override[];
  replayedFrom?: { decisionId: string; ruleSetVersion: string };
}

/** Pure. Displayed Trace, its linked overrides, and `replayedFrom` only for a replay. */
export function buildExport(s: DecisionState): ExportFile {
  const trace = displayedTrace(s);
  const file: ExportFile = {
    format: "bones.expense-auditor.export",
    formatVersion: 1,
    trace,
    overrides: linkedOverrides(s),
  };
  if (trace.decisionId !== s.original.decisionId) {
    file.replayedFrom = {
      decisionId: s.original.decisionId,
      ruleSetVersion: s.original.ruleSetVersion,
    };
  }
  return file;
}

export function serializeExport(f: ExportFile): string {
  return JSON.stringify(f, null, 2);
}

export function exportFileName(trace: Trace): string {
  return `expense-trace-${trace.decisionId.slice(0, 8)}.json`;
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
