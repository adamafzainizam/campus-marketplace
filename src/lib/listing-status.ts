/**
 * Listing status: what each state is called, who can see it, and validating
 * the value a seller submits.
 *
 * Relative imports with explicit extensions — reached by a test, so the `@/`
 * alias would fail at runtime. Known Gotchas #21 and #23.
 */

import {
  ListingStatus,
  type ListingType,
} from "../generated/prisma/enums.ts";
import { type Result } from "./listing-constraints.ts";

/**
 * The states a seller can move a listing into. All of them, currently — but
 * named separately from the enum so the UI's options and the database's values
 * can diverge later without one silently following the other.
 */
export const SELLER_SELECTABLE_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "SOLD",
  "ARCHIVED",
] as const satisfies readonly ListingStatus[];

/**
 * A function rather than a lookup table because the state is the same for
 * sales and rentals but the vocabulary is not: a rental marked "Sold" reads as
 * a bug. Only the terminal state actually differs.
 */
export function statusLabel(status: ListingStatus, type: ListingType): string {
  switch (status) {
    case "AVAILABLE":
      return "Available";
    case "RESERVED":
      return "Reserved";
    case "SOLD":
      return type === "RENT" ? "Rented out" : "Sold";
    case "ARCHIVED":
      return "Archived";
  }
}

/**
 * Whether a listing appears to people other than its seller.
 *
 * Sold and reserved listings stay on the browse page, visibly marked — it
 * shows a visitor the marketplace is actually used, and mirrors how eBay and
 * Carousell behave. Archived means the seller withdrew it.
 *
 * Written as an exhaustive switch rather than a "not archived" check so that
 * adding a status is a compile error here instead of silently defaulting to
 * publicly visible.
 */
export function isPubliclyVisible(status: ListingStatus): boolean {
  switch (status) {
    case "AVAILABLE":
    case "RESERVED":
    case "SOLD":
      return true;
    case "ARCHIVED":
      return false;
  }
}

/** The statuses a browse query should return. */
export const PUBLIC_STATUSES = Object.values(ListingStatus).filter(isPubliclyVisible);

/** Same prototype-chain guard as every other allowlist here — Gotcha #15. */
export function validateListingStatus(value: unknown): Result<ListingStatus> {
  if (typeof value !== "string") return { ok: false, error: "Status is required." };
  if (!Object.hasOwn(ListingStatus, value)) {
    return { ok: false, error: "Invalid status." };
  }
  return { ok: true, value: value as ListingStatus };
}
