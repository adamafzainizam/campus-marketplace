import { LoadingRegion, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <LoadingRegion label="Loading listing">
        <Skeleton className="mb-6 h-4 w-40 rounded" />
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-8 w-4/5 rounded" />
            <Skeleton className="h-6 w-1/3 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
            <Skeleton className="mt-2 h-20 w-full rounded" />
            <Skeleton className="mt-4 h-11 w-40 rounded-[var(--radius)]" />
          </div>
        </div>
      </LoadingRegion>
    </div>
  );
}
