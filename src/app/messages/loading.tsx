import { LoadingRegion, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <LoadingRegion label="Loading messages">
        <Skeleton className="mb-6 h-4 w-32 rounded" />
        <Skeleton className="mb-8 h-8 w-40 rounded" />
        <div className="card flex flex-col divide-y divide-[var(--border)] overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/3 rounded" />
                <Skeleton className="h-3.5 w-2/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </LoadingRegion>
    </div>
  );
}
