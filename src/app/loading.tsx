import { LoadingRegion, ListingGridSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <LoadingRegion label="Loading listings">
        <Skeleton className="mb-2 h-4 w-16 rounded" />
        <Skeleton className="mb-1 h-9 w-4/5 max-w-md rounded" />
        <Skeleton className="mb-6 h-4 w-3/5 max-w-xs rounded sm:mb-10" />
        <Skeleton className="mb-5 h-11 w-full rounded-[var(--radius)]" />
        <div className="mb-6 flex gap-2 overflow-hidden sm:mb-10">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <ListingGridSkeleton />
      </LoadingRegion>
    </div>
  );
}
