import { LoadingRegion, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <LoadingRegion label="Loading listing">
        <Skeleton className="mb-6 h-4 w-40 rounded" />
        <div className="grid gap-6 md:grid-cols-2 md:gap-10">
          <Skeleton className="aspect-square w-full rounded border-[1.5px] border-line shadow-md" />
          <div className="flex flex-col gap-3">
            <div className="text-display">
              <Skeleton className="h-[1lh] w-4/5 rounded" />
            </div>
            <div className="text-price-lg">
              <Skeleton className="h-[1lh] w-1/3 rounded" />
            </div>
            <div className="text-fine">
              <Skeleton className="h-[1lh] w-2/3 rounded" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-[1.5625rem] w-16 rounded-sm" />
              <Skeleton className="h-[1.5625rem] w-16 rounded-sm" />
            </div>
            <div className="flex flex-col leading-relaxed">
              <Skeleton className="h-[1lh] w-full rounded" />
              <Skeleton className="h-[1lh] w-full rounded" />
              <Skeleton className="h-[1lh] w-2/3 rounded" />
            </div>
            <Skeleton className="mt-2 h-[2.875rem] w-40 rounded" />
          </div>
        </div>
      </LoadingRegion>
    </div>
  );
}
