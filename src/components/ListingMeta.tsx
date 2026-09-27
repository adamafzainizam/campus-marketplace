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
 * `layout="split"` is the browse card's form: the facts on the left, recency
 * right-aligned, so the line never carries more than one middle dot. Every
 * caller uses it today. `layout="line"` (`category · condition · recency` on
 * one line) is kept only as the default until Phase 6 decides what the inbox
 * wants — it is not evidence any page still needs the one-line form.
 *
 * `wrap` (split layout only, default false): the card truncates its facts to
 * one line, but the detail page has room to be specific and needs to show
 * the "Other" category spelled out in full, so it wraps instead.
 *
 * A server component: `new Date()` is evaluated once during the render that
 * produced the listings, so nothing re-renders on the client and there is no
 * hydration mismatch to reconcile.
 */
export function ListingMeta({
  now = new Date(),
  layout = "line",
  wrap = false,
  className,
  ...input
}: Omit<ListingMetaInput, "now"> & {
  now?: Date;
  layout?: "line" | "split";
  wrap?: boolean;
  className?: string;
}) {
  if (layout === "split") {
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

  const parts = listingMetaParts({ ...input, now });
  if (parts.length === 0) return null;

  return <p className={className ?? "text-fine text-tertiary"}>{parts.join(" · ")}</p>;
}
