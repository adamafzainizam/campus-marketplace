import { LoadingRegion, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
      <LoadingRegion label="Loading conversation">
        <div className="mb-4 border-b border-line pb-4">
          <Skeleton className="mb-2 h-4 w-48 rounded" />
          <Skeleton className="h-6 w-2/3 rounded" />
        </div>
        <div className="flex flex-col gap-3">
          {/* Widths vary and sides alternate so it reads as a conversation
              rather than a table of identical rows. */}
          {[70, 45, 60, 35].map((width, i) => (
            <Skeleton
              key={i}
              className={`h-10 rounded-[var(--radius)] ${i % 2 ? "self-end" : ""}`}
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      </LoadingRegion>
    </div>
  );
}
