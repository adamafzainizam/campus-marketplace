/**
 * Where the catch-all category sits, and what has to be said when it is chosen.
 * No I/O.
 *
 * Relative imports with explicit extensions — reached by a test (Gotchas
 * #21/#23).
 */

import { type Result } from "./listing-constraints.ts";

/**
 * The slug of the catch-all. Seeded by `prisma/seed.ts`; matched by slug
 * rather than by name so renaming the label cannot silently break the rule.
 */
export const OTHER_CATEGORY_SLUG = "other";

export const MIN_OTHER_CATEGORY_LENGTH = 2;
export const MAX_OTHER_CATEGORY_LENGTH = 40;

export type CategoryLike = { id: string; name: string; slug: string };

export function isOtherCategorySlug(slug: unknown): boolean {
  return slug === OTHER_CATEGORY_SLUG;
}

/**
 * Alphabetical, but with the catch-all pinned to the bottom.
 *
 * Sorted here rather than by the database because "Other" sorts into the
 * middle of the alphabet, where it is both the easiest option to land on by
 * accident and the least informative one to pick. A category list is a
 * question, and the answer "none of these" belongs after the alternatives
 * rather than among them.
 *
 * Does not mutate its input — `getCategories` hands out a cached array, and
 * sorting that in place would reorder a value other callers already hold.
 */
export function sortCategoriesForDisplay<T extends CategoryLike>(
  categories: readonly T[],
): T[] {
  return [...categories].sort((a, b) => {
    const aOther = isOtherCategorySlug(a.slug);
    const bOther = isOtherCategorySlug(b.slug);
    if (aOther !== bOther) return aOther ? 1 : -1;
    return a.name.localeCompare(b.name, "en");
  });
}

/**
 * Validates the free-text description that accompanies "Other".
 *
 * Contextual on the chosen category, the same way `validateRentalPeriod` is
 * contextual on the listing type: required when the catch-all is selected,
 * and **discarded** otherwise. Discarding rather than merely ignoring matters
 * because the payload is untrusted — without it, a crafted request could
 * attach "Textbooks (unopened)" to a listing filed under Furniture, and the
 * detail page would render it.
 *
 * The length floor exists because "other", "stuff" and "-" answer nothing, and
 * the entire point of the field is to find out which category is missing.
 */
export function validateOtherCategory(
  raw: unknown,
  isOtherSelected: boolean,
): Result<string | null> {
  if (!isOtherSelected) return { ok: true, value: null };

  if (typeof raw !== "string") {
    return { ok: false, error: "Say what kind of item this is." };
  }

  const value = raw.trim();

  if (value.length < MIN_OTHER_CATEGORY_LENGTH) {
    return {
      ok: false,
      error: "Say what kind of item this is, so people can find it.",
    };
  }
  if (value.length > MAX_OTHER_CATEGORY_LENGTH) {
    return {
      ok: false,
      error: `Keep that under ${MAX_OTHER_CATEGORY_LENGTH} characters — it's a category, not a description.`,
    };
  }

  return { ok: true, value };
}

/**
 * How a listing's category reads to someone browsing.
 *
 * "Other" on its own tells a reader nothing, so when the seller said what they
 * meant, that is what gets shown.
 */
export function categoryDisplayName(
  categoryName: string,
  categorySlug: string,
  otherCategory: string | null,
): string {
  if (!isOtherCategorySlug(categorySlug)) return categoryName;
  const detail = otherCategory?.trim();
  return detail ? `Other — ${detail}` : categoryName;
}
