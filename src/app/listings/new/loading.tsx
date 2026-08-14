import { LoadingRegion, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6 sm:py-12">
      <LoadingRegion label="Loading form">
        <Skeleton className="mb-6 h-4 w-40 rounded" />
        <Skeleton className="mb-6 h-8 w-48 rounded" />
        <div className="flex flex-col gap-5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-11 w-full rounded-[var(--radius)]" />
            </div>
          ))}
        </div>
      </LoadingRegion>
    </div>
  );
}
