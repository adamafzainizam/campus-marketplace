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

/** Matches the browse grid's card proportions exactly. */
export function ListingCardSkeleton() {
  return (
    <li className="flex flex-col gap-2.5">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="h-4 w-3/4 rounded" />
      <Skeleton className="h-3.5 w-1/3 rounded" />
    </li>
  );
}

export function ListingGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul
      className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4"
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
