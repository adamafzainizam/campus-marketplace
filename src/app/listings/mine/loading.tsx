import { LoadingRegion, ListingGridSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <LoadingRegion label="Loading your listings">
        <Skeleton className="mb-6 h-4 w-40 rounded" />
        <div className="mb-6 flex items-center justify-between gap-3 sm:mb-10">
          <div className="text-display w-48">
            <Skeleton className="h-[1lh] w-full rounded" />
          </div>
          <Skeleton className="h-[2.875rem] w-36 rounded" />
        </div>
        <ListingGridSkeleton count={3} withControls />
      </LoadingRegion>
    </div>
  );
}
