const SVG_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  focusable: "false",
} as const;

/** Decorative arrow into a tray. */
export function IconDownload() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M8 2v8" />
      <path d="M4.5 7 8 10.5 11.5 7" />
      <path d="M3 13.5h10" />
    </svg>
  );
}

/** Decorative arrow out of a tray. */
export function IconLoad() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M8 11V3" />
      <path d="M4.5 6 8 2.5 11.5 6" />
      <path d="M3 13.5h10" />
    </svg>
  );
}

const BTN_SVG_PROPS = {
  className: "xr-btn-icon",
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  focusable: "false",
} as const;

/** Decorative circular arrow for the replay button. */
export function IconReplay() {
  return (
    <svg {...BTN_SVG_PROPS}>
      <path d="M4 12a8 8 0 1 0 2.6-5.9" />
      <path d="M4 4v4.5h4.5" />
    </svg>
  );
}

/** Decorative hand/check mark for the human override button. */
export function IconOverride() {
  return (
    <svg {...BTN_SVG_PROPS}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </svg>
  );
}
