export function VersionNote({ note }: { note: string | null }) {
  if (note === null) return null;
  return (
    <p role="status" className="app-note">
      {note}
    </p>
  );
}
