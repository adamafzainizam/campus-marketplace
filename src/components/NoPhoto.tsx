import { ImageIcon } from "@phosphor-icons/react/ssr";
import { ICON_WEIGHT } from "@/components/icon-style";

/**
 * What a listing with no photograph shows in place of one.
 *
 * A striped well with an icon and "No photo": the blank space on a board
 * where nothing has been pinned yet. It reads as a deliberate state rather
 * than as a failed image load.
 *
 * `compact` drops the label for thumbnails too narrow to hold it (the inbox
 * row, mainly). `bare` drops the icon and the label too, leaving only the
 * stripes, for when something else is centred on top: the browse card's
 * "Sold" stamp would otherwise collide with them. The accessible name is on
 * the wrapper in every variant, so the visible label is decoration and never
 * the only thing carrying the meaning.
 *
 * The card link this sits inside has no other accessible name of its own, so
 * `role="img"` plus this label becomes the *front* of the link's name: "No
 * photo, Title, RM 25, …". Deliberate: a sighted user sees the same absence
 * before they see the title. A listing with a photo contributes nothing here,
 * because this component only renders in the photo's absence.
 */
export function NoPhoto({
  compact = false,
  bare = false,
}: {
  compact?: boolean;
  bare?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label="No photo"
      className="photo-missing flex h-full w-full flex-col items-center justify-center gap-1 text-secondary"
    >
      {!bare && (
        <ImageIcon
          weight={ICON_WEIGHT}
          aria-hidden="true"
          className={compact ? "h-5 w-5" : "h-6 w-6"}
        />
      )}
      {!compact && !bare && <span className="text-fine font-semibold">No photo</span>}
    </span>
  );
}
