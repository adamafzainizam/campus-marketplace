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

/** Matches the browse grid's card proportions exactly — a bordered card with
 *  a 4:3 image, a title, a price and a meta line. A silhouette that no longer
 *  matches is worse than none: the layout jumps when the content lands, and a
 *  7.3s cold start means this is on screen often. */
export function ListingCardSkeleton() {
  return (
    <li className="card overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="flex flex-col gap-1 p-3">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-5 w-2/5 rounded" />
        <Skeleton className="h-3.5 w-4/5 rounded" />
      </div>
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
export function ListingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul
      className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </ul>
  );
}

export function RowSkeleton() {
  return (
    <div className="card flex gap-4 p-4">
      <Skeleton className="h-24 w-24 shrink-0 rounded-lg" />
      <div className="flex flex-1 flex-col gap-2 py-1">
        <Skeleton className="h-4 w-1/2 rounded" />
        <Skeleton className="h-3.5 w-1/4 rounded" />
        <Skeleton className="mt-auto h-8 w-40 rounded" />
      </div>
    </div>
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
