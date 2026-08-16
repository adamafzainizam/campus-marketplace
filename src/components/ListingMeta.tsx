import { listingMetaParts, type ListingMetaInput } from "@/lib/listing-labels";

/**
 * The `category · condition · recency` line, shared by the browse card,
 * `/listings/mine` and the listing detail page.
 *
 * Extracted because those three pages need different *layouts* and the same
 * *vocabulary*, and conflating the two is how a site ends up with three
 * unrelated card designs. Two pages should differ because their content
 * differs, never because they were built on different days.
 *
 * A server component: `new Date()` is evaluated once during the render that
 * produced the listings, so nothing re-renders on the client and there is no
 * hydration mismatch to reconcile.
 */
export function ListingMeta({
  now = new Date(),
  className = "text-fine text-tertiary",
  ...input
}: Omit<ListingMetaInput, "now"> & { now?: Date; className?: string }) {
  const parts = listingMetaParts({ ...input, now });
  if (parts.length === 0) return null;

  return <p className={className}>{parts.join(" · ")}</p>;
}
