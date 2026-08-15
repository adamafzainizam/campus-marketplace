/**
 * How many of a thing a seller has. No I/O.
 *
 * Relative imports with explicit extensions — reached by a test (#21/#23).
 */

import { type Result } from "./listing-constraints.ts";

export const MIN_QUANTITY = 1;

/**
 * An arbitrary ceiling, chosen to be far above any real campus listing while
 * still bounding what can be typed into the field. Somebody selling 1,000 of
 * something is running a business, which the Acceptable Use Policy already
 * covers.
 */
export const MAX_QUANTITY = 999;

/**
 * Validates the quantity a seller states.
 *
 * **This is not stock control, and nothing here should imply that it is.** No
 * money passes through this site, so it never learns a sale happened and can
 * never decrement anything. The number means "the seller said they had this
 * many when they last edited the listing" and nothing stronger. Everything
 * that renders it is worded accordingly.
 *
 * Accepts a string because it arrives from a number input, which yields
 * strings, and `Number("")` is 0 rather than NaN — so an empty field would
 * silently become a quantity of zero without the explicit check below.
 */
export function validateQuantity(raw: unknown): Result<number> {
  if (raw === undefined || raw === null || raw === "") {
    // Absent means the seller never opened the "more than one" control.
    return { ok: true, value: MIN_QUANTITY };
  }

  if (typeof raw !== "string" && typeof raw !== "number") {
    return { ok: false, error: "How many do you have?" };
  }

  const value = typeof raw === "number" ? raw : Number(raw.trim());

  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return { ok: false, error: "Quantity has to be a whole number." };
  }
  if (value < MIN_QUANTITY) {
    return { ok: false, error: "Quantity has to be at least 1." };
  }
  if (value > MAX_QUANTITY) {
    return {
      ok: false,
      error: `Quantity has to be ${MAX_QUANTITY} or fewer.`,
    };
  }

  return { ok: true, value };
}

/** Whether the quantity is worth mentioning at all. One of something is unremarkable. */
export function hasMultiple(quantity: number): boolean {
  return quantity > MIN_QUANTITY;
}

/**
 * How a quantity reads on a listing.
 *
 * "3 available" rather than "3 in stock": the first describes what the seller
 * told us, the second implies a system that knows. It does not.
 */
export function quantityLabel(quantity: number): string | null {
  if (!hasMultiple(quantity)) return null;
  return `${quantity} available`;
}
