/**
 * Single source of truth for listing-creation rules.
 *
 * Extracted from the `createListing` server action so the rules can be tested
 * directly. A server action is a public POST endpoint — Next.js's own guidance
 * for this version is blunt about it: "Treat FormData, query parameters, and
 * headers as untrusted." Every function here therefore takes `unknown` and
 * establishes the type before calling any method on the value. The previous
 * inline version called `input.title.trim()` before checking `title` was a
 * string, which turned a hostile payload into an unhandled TypeError and a 500.
 */

// Relative, with an explicit extension, rather than the `@/` alias used
// elsewhere: this module is imported by a test, and `node --test` resolves
// imports itself without reading tsconfig `paths`. The alias fails at runtime
// even when it is a *transitive* import — see Known Gotchas #21.
import {
  ListingCondition,
  ListingType,
  RentalPeriod,
  ServiceRate,
} from "../generated/prisma/enums.ts";

export const TITLE_MIN_LENGTH = 3;
export const TITLE_MAX_LENGTH = 100;
export const DESCRIPTION_MIN_LENGTH = 10;
export const DESCRIPTION_MAX_LENGTH = 2000;

/** Up to 8 digits and at most 2 decimals, matching Decimal(10,2) in the schema. */
const PRICE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

export type Valid<T> = { ok: true; value: T };
export type Invalid = { ok: false; error: string };
export type Result<T> = Valid<T> | Invalid;

const invalid = (error: string): Invalid => ({ ok: false, error });

export function validateTitle(value: unknown): Result<string> {
  if (typeof value !== "string") return invalid("Title is required.");
  const title = value.trim();
  if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) {
    return invalid(
      `Title must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters.`,
    );
  }
  return { ok: true, value: title };
}

export function validateDescription(value: unknown): Result<string> {
  if (typeof value !== "string") return invalid("Description is required.");
  const description = value.trim();
  if (
    description.length < DESCRIPTION_MIN_LENGTH ||
    description.length > DESCRIPTION_MAX_LENGTH
  ) {
    return invalid(
      `Description must be between ${DESCRIPTION_MIN_LENGTH} and ${DESCRIPTION_MAX_LENGTH} characters.`,
    );
  }
  return { ok: true, value: description };
}

/**
 * Price stays a string all the way to Prisma, which is what Decimal(10,2)
 * wants. Converting to a float to check it would reintroduce exactly the
 * precision problem the schema chose Decimal to avoid.
 */
export function validatePrice(value: unknown): Result<string> {
  if (typeof value !== "string") return invalid("Price is required.");
  const price = value.trim();
  if (!PRICE_PATTERN.test(price)) {
    return invalid("Price must be a number with up to 2 decimal places.");
  }
  if (Number(price) <= 0) {
    return invalid("Price must be greater than zero.");
  }
  return { ok: true, value: price };
}

/**
 * Guarded with `Object.hasOwn` rather than a bare lookup, for the same reason
 * `imageExtensionFor` is — see Known Gotchas #15. An allowlist keyed by user
 * input is bypassable through the prototype chain otherwise.
 */
/**
 * Condition is contextual on the listing type.
 *
 * An object has a condition; an hour of somebody's time does not. Required for
 * SALE and RENT, and **discarded** for SERVICE rather than merely ignored —
 * without that, a crafted payload leaves a tutoring listing advertised as
 * "Like new".
 *
 * This is the third field to work this way, after `rentalPeriod` on type and
 * `otherCategory`/`halalStatus` on category.
 */
export function validateCondition(
  value: unknown,
  type: ListingType,
): Result<ListingCondition | null> {
  if (type === "SERVICE") return { ok: true, value: null };

  if (typeof value !== "string") return invalid("Condition is required.");
  if (!Object.hasOwn(ListingCondition, value)) {
    return invalid("Invalid condition.");
  }
  return { ok: true, value: value as ListingCondition };
}

/**
 * The service rate is contextual in the same way the rental period is: a
 * price with no unit says nothing. "RM 30" could be an hour of tutoring or a
 * whole job, so SERVICE must carry one, and everything else discards it.
 */
export function validateServiceRate(
  value: unknown,
  type: ListingType,
): Result<ServiceRate | null> {
  if (type !== "SERVICE") return { ok: true, value: null };

  if (typeof value !== "string" || value.length === 0) {
    return invalid("Choose what the price is per.");
  }
  if (!Object.hasOwn(ServiceRate, value)) {
    return invalid("Invalid service rate.");
  }
  return { ok: true, value: value as ServiceRate };
}

/** Same prototype-chain guard as `validateCondition` — Known Gotchas #15. */
export function validateListingType(value: unknown): Result<ListingType> {
  if (typeof value !== "string") return invalid("Listing type is required.");
  if (!Object.hasOwn(ListingType, value)) {
    return invalid("Invalid listing type.");
  }
  return { ok: true, value: value as ListingType };
}

/**
 * The rental period is contextual: required for a rental, meaningless for a
 * sale.
 *
 * A rental price without a unit says nothing — "RM20" could be a day or a
 * semester — so RENT must carry one. For SALE the submitted value is
 * *discarded* rather than merely ignored, so a crafted payload cannot leave a
 * sale rendering as "RM20 / week".
 */
export function validateRentalPeriod(
  value: unknown,
  type: ListingType,
): Result<RentalPeriod | null> {
  if (type !== "RENT") return { ok: true, value: null };

  if (typeof value !== "string" || value.length === 0) {
    return invalid("Choose how often the rental price applies.");
  }
  if (!Object.hasOwn(RentalPeriod, value)) {
    return invalid("Invalid rental period.");
  }
  return { ok: true, value: value as RentalPeriod };
}

/**
 * Ids are opaque to this module — it only confirms the shape is plausible
 * before the value reaches a database query. cuid() ids are alphanumeric.
 */
export function validateId(value: unknown, label: string): Result<string> {
  if (typeof value !== "string") return invalid(`${label} is required.`);
  const id = value.trim();
  if (id.length === 0 || id.length > 64 || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return invalid(`Invalid ${label.toLowerCase()}.`);
  }
  return { ok: true, value: id };
}
