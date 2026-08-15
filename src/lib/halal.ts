/**
 * Halal status on food listings. No I/O.
 *
 * The governing fact, which shapes every function here: **this is a claim by
 * the seller, not a certification.** Halal certification in Malaysia is
 * JAKIM's to grant, this site verifies nothing, and a student ticking a box is
 * not evidence. Every label produced here therefore attributes the statement
 * to the seller. Rendering a bare "Halal" badge would present a stranger's
 * unverified assertion as established fact about a religious dietary
 * restriction, which is the one thing this feature must not do.
 *
 * Relative imports with explicit extensions — reached by a test (#21/#23).
 */

import { HalalStatus } from "../generated/prisma/enums.ts";
import { type Result } from "./listing-constraints.ts";

/** The category this applies to. Matched by slug, never by label. */
export const FOOD_CATEGORY_SLUG = "food-drink";

export function isFoodCategorySlug(slug: unknown): boolean {
  return slug === FOOD_CATEGORY_SLUG;
}

/**
 * The order the options appear in.
 *
 * `UNSPECIFIED` is last but present, so that declining to claim is a visible
 * choice rather than the path of least resistance — and so that a seller who
 * genuinely does not know has an honest answer available instead of guessing.
 */
export const HALAL_STATUSES = [
  HalalStatus.HALAL,
  HalalStatus.NON_HALAL,
  HalalStatus.UNSPECIFIED,
] as const;

/** What the seller picks. Phrased from their side: they are making a statement. */
export function halalOptionLabel(status: HalalStatus): string {
  switch (status) {
    case HalalStatus.HALAL:
      return "Halal";
    case HalalStatus.NON_HALAL:
      return "Not halal";
    case HalalStatus.UNSPECIFIED:
      return "I'd rather not say / I don't know";
  }
}

/** A line under each option, so the choice is made knowingly. */
export function halalOptionHint(status: HalalStatus): string {
  switch (status) {
    case HalalStatus.HALAL:
      return "Only pick this if you are sure — including the ingredients and how it was prepared.";
    case HalalStatus.NON_HALAL:
      return "Contains non-halal ingredients, or you can't vouch for how it was prepared.";
    case HalalStatus.UNSPECIFIED:
      return "Honest, and better than guessing. Buyers will be told you didn't say.";
  }
}

/**
 * What a buyer sees.
 *
 * Always attributed. "Seller says: halal" is a true statement about what
 * happened on this site; "Halal" is a claim the site is in no position to
 * make.
 */
export function halalDisplayLabel(status: HalalStatus | null): string | null {
  if (status === null) return null;
  switch (status) {
    case HalalStatus.HALAL:
      return "Seller says: halal";
    case HalalStatus.NON_HALAL:
      return "Seller says: not halal";
    case HalalStatus.UNSPECIFIED:
      return "Seller hasn't said whether this is halal";
  }
}

/**
 * The standing caveat shown alongside any halal statement.
 *
 * One exported string rather than wording retyped per page, for the same
 * reason `AFFILIATION_DISCLAIMER` is one string: a caveat that varies is a
 * caveat somebody will eventually soften.
 */
export const HALAL_NOT_VERIFIED =
  "This is the seller's own statement. Nothing on this site is halal-certified or checked by anyone — if it matters to you, ask them directly before buying.";

/**
 * Validates the halal status submitted with a listing.
 *
 * Contextual on the category, like `rentalPeriod` on type and `otherCategory`
 * on the catch-all: **required** for food, and **discarded** for everything
 * else. Discarding matters because the payload is untrusted — otherwise a
 * crafted request could attach "Seller says: halal" to a bicycle, and worse,
 * to something that is food but filed elsewhere.
 *
 * Required rather than optional for food because silence about a dietary
 * restriction is the harmful state. `UNSPECIFIED` exists so that "required"
 * never forces a false claim.
 */
export function validateHalalStatus(
  raw: unknown,
  isFoodSelected: boolean,
): Result<HalalStatus | null> {
  if (!isFoodSelected) return { ok: true, value: null };

  if (typeof raw !== "string" || !Object.hasOwn(HalalStatus, raw)) {
    return {
      ok: false,
      error: "Say whether this food is halal — pick one of the options.",
    };
  }

  return { ok: true, value: HalalStatus[raw as keyof typeof HalalStatus] };
}
