/**
 * Display labels and price formatting for listings.
 *
 * Relative import with an explicit `.ts` extension rather than the `@/` alias
 * used elsewhere: this module is reached by a test, and `node --test` resolves
 * imports without reading tsconfig `paths`. Known Gotchas #21 and #23.
 */

import type {
  ListingCondition,
  ListingType,
  RentalPeriod,
} from "../generated/prisma/enums.ts";

export const CONDITION_LABELS: Record<ListingCondition, string> = {
  NEW: "New",
  LIKE_NEW: "Like new",
  GOOD: "Good",
  FAIR: "Fair",
  WORN: "Worn",
};

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  SALE: "For sale",
  RENT: "For rent",
};

/** Lowercase: these read as the tail of a price, e.g. "RM 20.00 / week". */
export const RENTAL_PERIOD_LABELS: Record<RentalPeriod, string> = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  SEMESTER: "semester",
};

/**
 * Renders a price, with its rental unit when there is one.
 *
 * Takes anything stringable so it can be handed Prisma's `Decimal` directly —
 * the value must never go through a float, which is why the schema uses
 * Decimal(10,2) in the first place.
 *
 * A rental with no period falls back to a bare price rather than rendering
 * "/ undefined": the data would be wrong, but the page should not be.
 */
export function formatPrice(
  price: { toString(): string },
  type: ListingType,
  rentalPeriod: RentalPeriod | null,
): string {
  const amount = `RM ${price.toString()}`;
  if (type !== "RENT" || rentalPeriod === null) return amount;

  const period = RENTAL_PERIOD_LABELS[rentalPeriod];
  return period ? `${amount} / ${period}` : amount;
}
