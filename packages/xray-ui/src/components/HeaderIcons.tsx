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
