import { LoadingRegion, ListingGridSkeleton, Skeleton } from "@/components/Skeleton";

/* Mirrors the browse page band for band (headline, tagline, search, the
   type control, the category rail, the grid) with the same spacing, so the
   page lands without shifting. Bars are sized in `lh` from the real type
   classes rather than to a guessed pixel height, since a glyph-height guess
   runs a few pixels short of the line box and the shift shows up once real
   content lands. The signed-out sign-in line under the tagline is
   deliberately not mirrored here: this is a Server Component with no
   session to branch on, so guessing either way would be wrong for half of
   visitors. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <LoadingRegion label="Loading listings">
        <div className="mb-6">
          <div className="text-display">
            <Skeleton className="h-[2lh] w-4/5 max-w-xl rounded sm:h-[1lh]" />
          </div>
          <div className="mt-1">
            <Skeleton className="h-[1lh] w-3/5 max-w-xs rounded" />
          </div>
        </div>
        <div className="mb-3 flex flex-col gap-2.5 sm:flex-row">
          <Skeleton className="h-[2.875rem] min-w-0 flex-1 rounded" />
          <Skeleton className="h-[2.875rem] w-full rounded sm:w-24" />
        </div>
        <Skeleton className="mb-3 h-[2.875rem] w-full rounded sm:w-[23rem]" />
        <div className="rail mb-6 flex gap-2 overflow-hidden pb-1">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[2.25rem] w-24 shrink-0 rounded" />
          ))}
        </div>
        <ListingGridSkeleton />
      </LoadingRegion>
    </div>
  );
}
