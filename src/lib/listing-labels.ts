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
 * Only a plain decimal number is safe to pad — anything else is returned
 * untouched rather than mangled into something that looks like money.
 */
const PLAIN_AMOUNT = /^-?\d+(\.\d+)?$/;

/**
 * Restores the second cent digit on a price that has cents: "0.1" → "0.10".
 *
 * Prisma returns `Decimal`, which is decimal.js, and decimal.js normalises
 * trailing zeros — so a `Decimal(10,2)` column holding 0.10 stringifies to
 * "0.1" and a price of ten cents rendered as "RM 0.1". The database was never
 * wrong; the loss happened on the way to the screen.
 *
 * **A whole number is deliberately left alone**: "RM 20" rather than
 * "RM 20.00". That was the builder's call on 2026-08-17, made against a
 * rendering of the real browse page, and it is the reason this function is not
 * simply `toFixed(2)`. Most prices on a campus marketplace have no cents, and
 * padding them all buys alignment at the cost of making every price heavier to
 * read. The trade accepted is that two shapes now coexist in one grid.
 *
 * Done as string surgery rather than `Number(...).toFixed(2)` because money in
 * this project must never pass through a float — the same reason the column is
 * `Decimal(10,2)` rather than `Float`.
 *
 * A fraction longer than two digits is left alone rather than rounded. It is
 * unreachable through a 2dp column, and quietly rounding somebody's money is a
 * worse failure than showing an odd-looking price.
 */
function padCentsToTwoPlaces(raw: string): string {
  if (!PLAIN_AMOUNT.test(raw)) return raw;

  const [whole, fraction] = raw.split(".");
  // No decimal point at all means no cents to complete — see above.
  if (fraction === undefined || fraction.length >= 2) return raw;

  return `${whole}.${fraction.padEnd(2, "0")}`;
}

/** A price split so the unit can be styled differently from the amount. */
export type PriceParts = {
  amount: string;
  /** e.g. "/ week". Null when the price is the whole statement. */
  unit: string | null;
};

/**
 * Splits a price into its amount and its unit.
 *
 * The card renders the amount at full weight and the unit smaller and greyer,
 * which a single joined string cannot express. Splitting it here rather than
 * in JSX keeps one rule in one place: `formatPrice` below is defined in terms
 * of this function, and a test asserts the two agree.
 *
 * Takes anything stringable so it can be handed Prisma's `Decimal` directly —
 * the value must never go through a float, which is why the schema uses
 * Decimal(10,2) in the first place.
 *
 * A rental with no period falls back to a bare price rather than rendering
 * "/ undefined": the data would be wrong, but the page should not be.
 */
export function priceParts(
  price: { toString(): string },
  type: ListingType,
  rentalPeriod: RentalPeriod | null,
  serviceRate: ServiceRate | null = null,
): PriceParts {
  const amount = `RM ${padCentsToTwoPlaces(price.toString())}`;

  if (type === "RENT" && rentalPeriod !== null) {
    const period = RENTAL_PERIOD_LABELS[rentalPeriod];
    return { amount, unit: period ? `/ ${period}` : null };
  }

  if (type === "SERVICE" && serviceRate !== null) {
    // FIXED maps to an empty label, so this also covers "no unit wanted".
    const rate = SERVICE_RATE_LABELS[serviceRate];
    return { amount, unit: rate ? `/ ${rate}` : null };
  }

  return { amount, unit: null };
}

/**
 * The value to prefill a price input with: the price as it renders, less "RM".
 *
 * Same correction as the rendered price, one layer away — an edit form showing
 * "0.1" for a listing priced at ten cents is the same defect, and the seller is
 * the one person guaranteed to look closely at it. No currency prefix, because
 * the field already carries one in its label and the server would reject it.
 *
 * Whole numbers stay whole here for a reason beyond matching the display:
 * anything this returns is what the form posts back if the seller edits some
 * other field, so rewriting an untouched "20" into "20.00" would make opening
 * the form quietly change a value nobody chose to change.
 *
 * A test asserts that what this produces is something `validatePrice` accepts,
 * since the form hands the value straight back on submit.
 */
export function priceInputValue(price: { toString(): string }): string {
  return padCentsToTwoPlaces(price.toString());
}

/**
 * Renders a price, with its rental or service unit when there is one.
 *
 * The joined form, for everywhere the price is one piece of text.
 */
export function formatPrice(
  price: { toString(): string },
  type: ListingType,
  rentalPeriod: RentalPeriod | null,
  serviceRate: ServiceRate | null = null,
): string {
  const { amount, unit } = priceParts(price, type, rentalPeriod, serviceRate);
  return unit ? `${amount} ${unit}` : amount;
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

/** What the shared meta line needs to know. See `ListingMeta`. */
export type ListingMetaInput = {
  /** Already resolved for display — the detail page passes the "Other — …" form. */
  category: string;
  /** Null for services, which have no condition. */
  condition: ListingCondition | null;
  postedAt: Date;
  now: Date;
  /** Page-specific facts appended after recency, nulls dropped. */
  extra?: readonly (string | null | undefined)[];
};

/**
 * The `category · condition · recency` line, as a list of parts.
 *
 * Anything absent is *omitted* rather than rendered as an empty slot: a
 * service has no condition, and "Tutoring ·  · 2d ago" is worse than saying
 * less. The joining is left to the caller so the separator lives in one place
 * (`ListingMeta`) and this stays testable as data.
 */
export function listingMetaParts(input: ListingMetaInput): string[] {
  const parts: Array<string | null | undefined> = [
    input.category,
    input.condition ? CONDITION_LABELS[input.condition] : null,
    postedAgo(input.postedAt, input.now),
    ...(input.extra ?? []),
  ];

  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);
}
