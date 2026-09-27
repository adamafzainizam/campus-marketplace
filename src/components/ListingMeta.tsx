import { cardMetaParts, listingMetaParts, type ListingMetaInput } from "@/lib/listing-labels";

/**
 * The listing meta line, shared by the browse card, `/listings/mine` and the
 * listing detail page.
 *
 * Extracted because those pages need different *layouts* and the same
 * *vocabulary*, and conflating the two is how a site ends up with three
 * unrelated card designs. Two pages should differ because their content
 * differs, never because they were built on different days.
 *
 * `layout="line"` is `category · condition · recency` on one line.
 * `layout="split"` is the browse card's form: the facts on the left, recency
 * right-aligned, so the line never carries more than one middle dot.
 *
 * A server component: `new Date()` is evaluated once during the render that
 * produced the listings, so nothing re-renders on the client and there is no
 * hydration mismatch to reconcile.
 */
export function ListingMeta({
  now = new Date(),
  layout = "line",
  className,
  ...input
}: Omit<ListingMetaInput, "now"> & {
  now?: Date;
  layout?: "line" | "split";
  className?: string;
}) {
  if (layout === "split") {
    const { facts, recency } = cardMetaParts({ ...input, now });
    return (
      <p className={`flex items-baseline justify-between gap-2 text-fine ${className ?? ""}`}>
        <span className="min-w-0 truncate text-secondary">{facts.join(" · ")}</span>
        <span className="shrink-0 text-tertiary">{recency}</span>
      </p>
    );
  }

  const parts = listingMetaParts({ ...input, now });
  if (parts.length === 0) return null;

  return <p className={className ?? "text-fine text-tertiary"}>{parts.join(" · ")}</p>;
}
