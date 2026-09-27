import { LoadingRegion, ListingGridSkeleton, Skeleton } from "@/components/Skeleton";

/* Mirrors the browse page band for band (headline, tagline, search, the
   type control, the category rail, the grid) with the same spacing, so the
   page lands without shifting. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <LoadingRegion label="Loading listings">
        <div className="mb-6">
          <Skeleton className="h-9 w-4/5 max-w-xl rounded sm:h-10" />
          <Skeleton className="mt-1 h-5 w-3/5 max-w-xs rounded" />
        </div>
        <div className="mb-3 flex flex-col gap-2.5 sm:flex-row">
          <Skeleton className="h-11 min-w-0 flex-1 rounded" />
          <Skeleton className="h-11 w-full rounded sm:w-24" />
        </div>
        <Skeleton className="mb-3 h-11 w-full rounded sm:w-80" />
        <div className="mb-6 flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[2.125rem] w-24 shrink-0 rounded" />
          ))}
        </div>
        <ListingGridSkeleton />
      </LoadingRegion>
    </div>
  );
}
