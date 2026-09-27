/**
 * Loading placeholders.
 *
 * These exist because the database sleeps. Neon auto-suspends on the free
 * tier, so the first request after an idle period takes seconds (measured at
 * 7.3s against production, versus ~0.3s warm). No amount of query tuning
 * removes that, which makes *perceived* response the only real fix — and the
 * better one anyway: a wait where the interface visibly reacts is a different
 * experience from a wait where nothing happens.
 *
 * Skeletons mirror the shape of the content they stand in for, so the layout
 * doesn't jump when the real thing arrives.
 */

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** Matches the browse card exactly: a bordered, shadowed card with a 4:3
 *  photo well ruled off at the bottom, a title, a price, and the split meta
 *  row (facts left, recency right). Each bar is sized to `1lh` inside a
 *  wrapper carrying the real type classes, not to a guessed pixel height —
 *  a bar sized to glyph height rather than line-box height is a few pixels
 *  short of the text it stands in for, and at three bars a card that looks
 *  fine in isolation adds up to a real page shift once real content lands.
 *  A silhouette that no longer matches is worse than none: the layout jumps
 *  when the content lands, and a 7.3s cold start means this is on screen
 *  often. */
export function ListingCardSkeleton({
  withControls = false,
}: {
  withControls?: boolean;
}) {
  return (
    <li className={`card overflow-hidden${withControls ? " flex h-full flex-col" : ""}`}>
      <Skeleton className="aspect-[4/3] w-full border-b-[1.5px] border-line" />
      <div className="flex flex-col gap-1 p-3">
        <div className="text-sm leading-snug sm:text-base">
          <Skeleton className="h-[1lh] w-3/4 rounded-sm" />
        </div>
        <div className="text-price">
          <Skeleton className="h-[1lh] w-2/5 rounded-sm" />
        </div>
        <div className="flex justify-between gap-2 text-fine">
          <Skeleton className="h-[1lh] w-1/2 rounded-sm" />
          <Skeleton className="h-[1lh] w-8 rounded-sm" />
        </div>
      </div>
      {withControls && (
        <div className="mx-3 mt-auto flex gap-2 border-t-[1.5px] border-dashed border-line py-3">
          <Skeleton className="h-9 w-28 rounded" />
          <Skeleton className="h-9 w-14 rounded" />
        </div>
      )}
    </li>
  );
}

/**
 * The skeleton has to guess the shape of a board it hasn't fetched yet.
 * Guessing the common case is the whole job: the board sits below the
 * sparse threshold today, not above it, so this assumes three columns and
 * two rows of it rather than the full four-column silhouette — the wrong
 * guess used to be free because the real grid's column count never varied,
 * and stopped being free the moment it did.
 */
export function ListingGridSkeleton({
  count = 6,
  withControls = false,
}: {
  count?: number;
  withControls?: boolean;
}) {
  return (
    <ul
      className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <ListingCardSkeleton key={i} withControls={withControls} />
      ))}
    </ul>
  );
}

/**
 * Announced to screen readers once, rather than each skeleton element
 * chattering — the visual placeholders are aria-hidden for that reason.
 */
export function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
