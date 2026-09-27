import { cardMetaParts, type ListingMetaInput } from "@/lib/listing-labels";

/**
 * The listing meta line, shared by the browse card and the listing detail
 * page.
 *
 * Extracted because those pages need the same *vocabulary*, and conflating
 * vocabulary with layout is how a site ends up with three unrelated card
 * designs. Two pages should differ because their content differs, never
 * because they were built on different days.
 *
 * Split layout only: the facts on the left, recency right-aligned, so the
 * line never carries more than one middle dot. `listingMetaParts` in
 * `listing-labels.ts` still exists, since `cardMetaParts`'s own test ties the
 * two together, but no page has needed the one-line form since Phase 4.
 *
 * `wrap` (default false): the card truncates its facts to one line, but the
 * detail page has room to be specific and needs to show the "Other" category
 * spelled out in full, so it wraps instead.
 *
 * A server component: `new Date()` is evaluated once during the render that
 * produced the listings, so nothing re-renders on the client and there is no
 * hydration mismatch to reconcile.
 */
export function ListingMeta({
  now = new Date(),
  wrap = false,
  className,
  ...input
}: Omit<ListingMetaInput, "now"> & {
  now?: Date;
  wrap?: boolean;
  className?: string;
}) {
  const { facts, recency } = cardMetaParts({ ...input, now });
  return (
    <p
      className={`flex justify-between gap-2 text-fine ${
        wrap ? "items-start" : "items-baseline"
      } ${className ?? ""}`}
    >
      <span className={`min-w-0 text-secondary ${wrap ? "" : "truncate"}`}>
        {facts.join(" · ")}
      </span>
      <span className="shrink-0 text-tertiary">{recency}</span>
    </p>
  );
}
