import { ImageIcon } from "@phosphor-icons/react/ssr";
import { ICON_WEIGHT } from "@/components/icon-style";

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
 *
 * The card link this sits inside has no other accessible name of its own —
 * the image slot is the first thing in it — so `role="img"` plus this label
 * becomes the *front* of the link's name: "No photo yet, Title, RM 25.00, …".
 * That is deliberate, not an oversight: a sighted user sees the same absence
 * before they see the title, so a screen reader announcing it first is parity,
 * not a bug. It is not double-announced, because a listing with a photo
 * contributes nothing here at all — this component only renders in the
 * photo's absence.
 */
export function NoPhoto({ compact = false }: { compact?: boolean }) {
  return (
    <span
      role="img"
      aria-label="No photo yet"
      className="flex h-full w-full flex-col items-center justify-center gap-1 text-tertiary"
    >
      <ImageIcon
        weight={ICON_WEIGHT}
        aria-hidden="true"
        className={compact ? "h-5 w-5" : "h-6 w-6"}
      />
      {!compact && <span className="text-fine">No photo yet</span>}
    </span>
  );
}
