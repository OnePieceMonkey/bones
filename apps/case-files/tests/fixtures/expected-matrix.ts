import type { VersionLabel } from "../../src/rules/catalog";

/** The nine-cell verdict matrix of the design (Data Models). Stored once. */
export type ExpectedVerdict = "accepted" | "unfair_none" | "unfair_many";

export interface ExpectedCell {
  caseId: "greenhouse" | "candlesticks" | "empty-room";
  label: VersionLabel;
  verdict: ExpectedVerdict;
  convictable: string[];
}

export const EXPECTED_MATRIX: readonly ExpectedCell[] = [
  { caseId: "greenhouse", label: "v1", verdict: "accepted", convictable: ["widow"] },
  { caseId: "greenhouse", label: "v2", verdict: "accepted", convictable: ["widow"] },
  { caseId: "greenhouse", label: "v3", verdict: "accepted", convictable: ["widow"] },
  { caseId: "candlesticks", label: "v1", verdict: "unfair_many", convictable: ["ada", "bram"] },
  { caseId: "candlesticks", label: "v2", verdict: "accepted", convictable: ["ada"] },
  { caseId: "candlesticks", label: "v3", verdict: "accepted", convictable: ["ada"] },
  { caseId: "empty-room", label: "v1", verdict: "unfair_none", convictable: [] },
  { caseId: "empty-room", label: "v2", verdict: "accepted", convictable: ["dana"] },
  { caseId: "empty-room", label: "v3", verdict: "unfair_none", convictable: [] },
];
