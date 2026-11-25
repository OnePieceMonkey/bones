/** Header note for a replayed Trace. `null` (the original v1) renders nothing. */
export function versionNoteText(selected: string): string | null {
  return selected === "v1" ? null : `Replayed with ${selected}. Original: v1.`;
}

export function VersionNote({ note }: { note: string | null }) {
  if (note === null) return null;
  return <p role="status">{note}</p>;
}
