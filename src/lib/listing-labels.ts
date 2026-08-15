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
  ServiceRate,
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
  SERVICE: "Service",
};

/** Lowercase: these read as the tail of a price, e.g. "RM 20.00 / week". */
export const RENTAL_PERIOD_LABELS: Record<RentalPeriod, string> = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  SEMESTER: "semester",
};

/**
 * Lowercase, like the rental periods, so they read as the tail of a price.
 * FIXED is empty on purpose: "RM 80" is the whole statement for a fixed job,
 * and "RM 80 / fixed" would be worse than saying nothing.
 */
export const SERVICE_RATE_LABELS: Record<ServiceRate, string> = {
  HOUR: "hour",
  SESSION: "session",
  ITEM: "item",
  FIXED: "",
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
  serviceRate: ServiceRate | null = null,
): string {
  const amount = `RM ${price.toString()}`;

  if (type === "RENT") {
    if (rentalPeriod === null) return amount;
    const period = RENTAL_PERIOD_LABELS[rentalPeriod];
    return period ? `${amount} / ${period}` : amount;
  }

  if (type === "SERVICE") {
    if (serviceRate === null) return amount;
    // FIXED maps to an empty label, so this also covers "no unit wanted".
    const rate = SERVICE_RATE_LABELS[serviceRate];
    return rate ? `${amount} / ${rate}` : amount;
  }

  return amount;
}

/**
 * Past this many days, a relative age stops being useful — "9w ago" makes a
 * reader do arithmetic — so an absolute date is shown instead.
 */
export const ABSOLUTE_DATE_AFTER_DAYS = 56;

const MONTH_ABBREVIATIONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * How long ago a listing was posted, in the coarsest unit that still says
 * something: "just now", "5h ago", "2d ago", "3w ago", then a date.
 *
 * `now` is a parameter rather than a call to `Date.now()` so this is testable
 * without freezing the clock — the same reason `formatPrice` takes its type
 * rather than reading it back off a listing.
 *
 * The absolute branch reads UTC fields so the output is deterministic wherever
 * the tests run. That is a few hours' difference from Malaysian local time on
 * a date at least eight weeks old, which nobody is reading that closely.
 */
export function postedAgo(date: Date, now: Date): string {
  const elapsedMs = now.getTime() - date.getTime();

  // A future date means a clock is wrong somewhere; counting backwards from it
  // would render "-3h ago". Treat it as brand new instead.
  const minutes = Math.floor(Math.max(elapsedMs, 0) / 60_000);
  if (minutes < 60) return "just now";

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < ABSOLUTE_DATE_AFTER_DAYS) return `${Math.floor(days / 7)}w ago`;

  const month = MONTH_ABBREVIATIONS[date.getUTCMonth()];
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
}
