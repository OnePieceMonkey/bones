import type { ReactNode } from "react";
import type { RuleOutcome, SourceLocation, DecisionResult, Trace } from "@bones/core";

export type Region =
  | "skull"
  | "spine"
  | "ribs"
  | "arm-left"
  | "arm-right"
  | "pelvis"
  | "leg-left"
  | "leg-right";

export const REGIONS: readonly Region[] = [
  "skull",
  "spine",
  "ribs",
  "arm-left",
  "arm-right",
  "pelvis",
  "leg-left",
  "leg-right",
];

export interface AnatomyBone {
  ruleId: string;
  label: string;
  region: Region;
}

export interface Anatomy {
  bones: AnatomyBone[];
  fieldLabels: Record<string, string>;
  formatValue?: (path: string, value: unknown) => string;
}

export type BoneState = "passed" | "not-applicable" | "fractured";

export interface Point {
  x: number;
  y: number;
}

export interface Splinter {
  angleDeg: number;
  length: number;
  size: number;
}

export interface BoneView {
  ruleId: string;
  label: string;
  /** Already normalised (unknown -> "spine"). */
  region: Region;
  /** Index in Anatomy.bones. */
  index: number;
  state: BoneState;
  /** outcome.ruleVersion, null when not-applicable. */
  version: string | null;
  /** Absent when not-applicable. */
  outcome?: RuleOutcome;
  /** viewBox coordinates. */
  position: Point;
  /** SPLINTER_COUNT entries when fractured, else []. */
  splinters: Splinter[];
}

export interface EvidenceRow {
  path: string;
  label: string;
  value: string;
}

export interface FieldView {
  path: string;
  label: string;
  /** Formatted value. */
  value: string;
  /** "0.97" or "n/a". */
  confidenceText: string;
  overruled: boolean;
  /** Anatomy labels of fractured bones, Anatomy order. */
  overruledBy: string[];
}

export type ChatKind = "greeting" | "fracture" | "summary" | "result";

export interface ChatMessage {
  id: string;
  text: string;
  kind: ChatKind;
}

export interface GaugeModel {
  value: number | null;
  angle: number;
  text: string;
}

export interface EcgModel {
  width: number;
  height: number;
  baseline: number;
  /** Beats (or flat line). */
  linePath: string;
  /** Red spikes, "" when none. */
  spikePath: string;
  spikeXs: number[];
  flatline: boolean;
  /** "2 spikes" | "1 spike" | "0 spikes" | "flatline". */
  summary: string;
}

export type FilmSource =
  | { kind: "text"; text: string }
  | { kind: "image"; src: string; alt: string };

export interface SourceMark {
  path: string;
  label: string;
  /** Short text label: 1-based index among defined sources, as a string. */
  tag: string;
  location: SourceLocation;
  highlighted: boolean;
}

export type { Trace, DecisionResult };

/* ------------------------------------------------------------------ */
/* Component props                                                     */
/* ------------------------------------------------------------------ */

export interface CommonProps {
  reducedMotion?: boolean;
  className?: string;
}

export interface LightboxProps extends CommonProps {
  title?: string;
  xray: boolean;
  /** Show the X-RAY ON/OFF pill. Default true. */
  pill?: boolean;
  /** Show the title as a visible plate. Default true. */
  plate?: boolean;
  children?: ReactNode;
}

export interface SkeletonProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
}

export interface BoneButtonProps extends CommonProps {
  bone: BoneView;
  describedBy?: string;
}

export interface BoneGlyphProps extends CommonProps {
  bone: BoneView;
}

export interface TooltipProps {
  id: string;
  bone: BoneView;
  anatomy: Anatomy;
}

export interface EcgLineProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
}

export interface FilmClipProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
  source: FilmSource;
  /** Overrides the context value when provided. */
  activeRuleId?: string | null;
}

export interface AnswerCardProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
  /** When true, fields without an Anatomy label render too, using their path as label. Default false. */
  showUnlabelled?: boolean;
}

export interface DrBonesChatProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
  /** Per character, default 24. */
  speedMs?: number;
  onMessagesComplete?: () => void;
  onReplay?: () => void;
  onOverride?: () => void;
}

export interface KnobControlProps extends CommonProps {
  versions: string[];
  value: string;
  onVersionChange: (version: string) => void;
  label?: string;
}

export interface GaugeControlProps extends CommonProps {
  trace: Trace;
  anatomy?: Anatomy;
}

export interface ToggleSwitchProps extends CommonProps {
  xray: boolean;
  onXrayChange: (next: boolean) => void;
}

export interface ControlStripProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
  versions: string[];
  value: string;
  onVersionChange: (version: string) => void;
  xray: boolean;
  onXrayChange: (next: boolean) => void;
}

export interface EffectiveResult {
  result: DecisionResult;
  reviewerName: string;
}

export interface ResultPlateProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
  effective?: EffectiveResult;
}

export interface XrayViewProps extends CommonProps {
  trace: Trace;
  anatomy: Anatomy;
  source: FilmSource;
  title?: string;
  versions: string[];
  version: string;
  onVersionChange: (v: string) => void;
  /** Uncontrolled with default true when absent. */
  xray?: boolean;
  onXrayChange?: (next: boolean) => void;
  onReplay?: () => void;
  onOverride?: () => void;
  onMessagesComplete?: () => void;
  effective?: EffectiveResult;
}
