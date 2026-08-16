/**
 * What a listing with no photograph shows in place of one.
 *
 * The browse grid's emptiest state is a listing nobody photographed, and it
 * used to be a large void with 10px grey text in the middle of it. An icon
 * plus a label reads as a deliberate state rather than as a failed image load.
 *
 * `compact` drops the label for thumbnails too narrow to hold it — the inbox
 * row, mainly. The accessible name is on the wrapper either way, so the label
 * is decoration and never the only thing carrying the meaning.
 */
export function NoPhoto({ compact = false }: { compact?: boolean }) {
  return (
    <span
      role="img"
      aria-label="No photo yet"
      className="flex h-full w-full flex-col items-center justify-center gap-1 text-tertiary"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={compact ? "h-5 w-5" : "h-6 w-6"}
      >
        <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
        <circle cx="8.75" cy="10" r="1.5" />
        <path d="M21 15.5 16.5 11 9 18.5" />
      </svg>
      {!compact && <span className="text-fine">No photo yet</span>}
    </span>
  );
}
