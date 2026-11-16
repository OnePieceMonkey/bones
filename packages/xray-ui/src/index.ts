import "./styles/tokens.css";
import "./styles/xray.css";
import "./styles/shell.css";
import "./styles/frame.css";
import "./styles/fonts.css";
import "./styles/header.css";
import "./styles/stage.css";
import "./styles/panels.css";
import "./styles/controls.css";

export * from "./types";

export { HeaderBar } from "./components/shell/HeaderBar";
export { HeaderAction } from "./components/shell/HeaderAction";
export { ShellFrame } from "./components/shell/ShellFrame";
export type { ShellFrameProps, IntroPhase } from "./components/shell/ShellFrame";
export { DocumentPanel } from "./components/panels/DocumentPanel";
export { GlassCard } from "./components/panels/GlassCard";
export type { GlassCardProps } from "./components/panels/GlassCard";
export { ResultFooter } from "./components/panels/ResultFooter";
export type { ResultFooterProps } from "./components/panels/ResultFooter";
export { SkeletonPhoto } from "./components/stage/SkeletonPhoto";
export type { SkeletonPhotoProps } from "./components/stage/SkeletonPhoto";
export { Stage } from "./components/stage/Stage";
export type { StageProps } from "./components/stage/Stage";
export { Hotspot } from "./components/stage/Hotspot";
export type { HotspotProps } from "./components/stage/Hotspot";
export { ControlPanel } from "./components/panel/ControlPanel";
export type { ControlPanelProps } from "./components/panel/ControlPanel";
export { Knob } from "./components/panel/Knob";
export type { KnobProps } from "./components/panel/Knob";
export { Meter } from "./components/panel/Meter";
export type { MeterProps } from "./components/panel/Meter";
export { Toggle } from "./components/panel/Toggle";
export type { ToggleProps } from "./components/panel/Toggle";
export { Lamp } from "./components/panel/Lamp";
export type { LampProps } from "./components/panel/Lamp";
export { Lightbox } from "./components/Lightbox";
export { Skeleton } from "./components/Skeleton";
export { BoneButton, BoneGlyph } from "./components/Bone";
export { Tooltip } from "./components/Tooltip";
export { EcgLine } from "./components/EcgLine";
export { FilmClip } from "./components/FilmClip";
export { AnswerCard } from "./components/AnswerCard";
export { DrBonesChat } from "./components/DrBonesChat";
export { ControlStrip } from "./components/ControlStrip";
export { KnobControl } from "./components/KnobControl";
export { GaugeControl } from "./components/GaugeControl";
export { ToggleSwitch } from "./components/ToggleSwitch";
export { ResultPlate } from "./components/ResultPlate";
export { XrayView } from "./components/XrayView";

export { useReducedMotion } from "./hooks/useReducedMotion";
export { useTypewriter } from "./hooks/useTypewriter";
export type { TypewriterOptions, TypewriterResult } from "./hooks/useTypewriter";
export { HoveredRuleProvider, useHoveredRule } from "./hooks/useHoveredRule";
export type { HoveredRuleValue } from "./hooks/useHoveredRule";

export {
  isFracture,
  isAppliedNoChange,
  stateText,
  fieldLabel,
  hasFieldLabel,
  selectBones,
  evidenceRows,
  relatedFields,
  relatedBones,
  overruledFields,
  fieldViews,
  sourceMarks,
  countPassed,
} from "./model/selectors";
export { SPLINTER_COUNT, CRACK_SEGMENTS, hashString, nextRandom, splinters, crackPath } from "./model/hash";
export { gaugeValue, buildGaugeModel } from "./model/confidence";
export { SWEEP, needleAngle, knobAngle, stepVersion } from "./model/gauge";
export { TEMPLATES, MAX_EVIDENCE_LINES, buildChatMessages } from "./model/chat";
export { defaultFormat, safeFormat, resultLabel, summariseValue } from "./model/format";
export type { Formatter } from "./model/format";
export { VIEWBOX, REGION_BOXES, layoutBone, chipFor } from "./model/skeletonLayout";
export type { RegionBox } from "./model/skeletonLayout";
export { ECG, ecgPath, buildEcgModel } from "./model/ecg";
