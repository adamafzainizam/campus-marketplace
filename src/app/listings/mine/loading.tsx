import { LoadingRegion, RowSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <LoadingRegion label="Loading your listings">
        <Skeleton className="mb-6 h-4 w-40 rounded" />
        <Skeleton className="mb-8 h-8 w-48 rounded" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => <RowSkeleton key={i} />)}
        </div>
      </LoadingRegion>
    </div>
  );
}
