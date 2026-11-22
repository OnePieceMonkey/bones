import "./styles/tokens.css";
import "./styles/xray.css";
import "./styles/shell.css";
import "./styles/frame.css";
import "./styles/fonts.css";
import "./styles/header.css";
import "./styles/stage.css";
import "./styles/panels.css";
import "./styles/controls.css";
import "./styles/sheet.css";
import "./styles/form.css";
import "./styles/intro.css";
import "./styles/motion.css";

export * from "./types";

export { AssetImage } from "./components/shell/AssetImage";
export type { AssetImageProps } from "./components/shell/AssetImage";
export { SteelFrame } from "./components/shell/SteelFrame";
export { ChatLog } from "./components/chat/ChatLog";
export { DoctorPanel } from "./components/panels/DoctorPanel";
export type { DoctorPanelProps } from "./components/panels/DoctorPanel";
export { HeaderBar } from "./components/shell/HeaderBar";
export { HeaderAction } from "./components/shell/HeaderAction";
export { IconDownload, IconLoad } from "./components/HeaderIcons";
export { Shell } from "./components/shell/Shell";
export type { ShellProps } from "./components/shell/Shell";
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
export { RuleBox } from "./components/stage/RuleBox";
export type { RuleBoxProps } from "./components/stage/RuleBox";
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
export { FilmSheet } from "./components/FilmSheet";
export type { FilmSheetProps } from "./components/FilmSheet";
export { Lightbox } from "./components/Lightbox";
export { Skeleton } from "./components/Skeleton";
export { BoneButton, BoneGlyph } from "./components/Bone";
export { Tooltip } from "./components/Tooltip";
export { EcgLine } from "./components/EcgLine";
export { FormStrip, FormStripField, FormStripFile } from "./components/FormStrip";
export type { FormStripProps, FormStripFieldProps, FormStripFileProps } from "./components/FormStrip";
export { StartHeadline } from "./components/StartHeadline";
export type { StartHeadlineProps } from "./components/StartHeadline";
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
export { useIntro } from "./hooks/useIntro";
export type { UseIntroOptions } from "./hooks/useIntro";
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
export { KNOB, KNOB_LABEL_GAP_U, knobLabelPositions, knobTicks } from "./model/knobLabels";
export type { KnobLabel, KnobTick } from "./model/knobLabels";
export { METER, RED_ZONE, meterPoint, meterTicks, redZoneArc } from "./model/meterGeometry";
export type { MeterTick } from "./model/meterGeometry";
export { TEMPLATES, MAX_EVIDENCE_LINES, buildChatMessages } from "./model/chat";
export { defaultFormat, safeFormat, resultLabel, summariseValue } from "./model/format";
export type { Formatter } from "./model/format";
export { VIEWBOX, REGION_BOXES, layoutBone, chipFor } from "./model/skeletonLayout";
export type { RegionBox } from "./model/skeletonLayout";
export { ECG, ECG_CENTER, ecgPath, ecgStartX, buildEcgModel } from "./model/ecg";
