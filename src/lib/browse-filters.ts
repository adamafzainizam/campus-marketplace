/**
 * Query-string handling for the browse page's filters.
 *
 * The browse page carries three independent filters — category, search term,
 * and sale/rent — and each control has to rebuild the URL while preserving the
 * other two. Doing that inline is how a category chip quietly throws away the
 * active search, so it lives here with tests instead.
 *
 * Relative import with an explicit extension: reached by a test, so the `@/`
 * alias would fail at runtime. Known Gotchas #21 and #23.
 */

import { ListingType } from "../generated/prisma/enums.ts";

export type BrowseFilters = {
  category?: string;
  q?: string;
  type?: string;
};

/**
 * Builds a browse URL from the currently active filters plus the ones this
 * link changes. Pass `undefined` for a filter to clear it.
 */
export function browseHref(
  current: BrowseFilters,
  changes: Partial<BrowseFilters>,
): string {
  const merged: BrowseFilters = { ...current, ...changes };
  const params = new URLSearchParams();

  for (const key of ["category", "q", "type"] as const) {
    const value = merged[key]?.trim();
    // An empty filter is no filter; emitting `?q=` would just be noise in the
    // URL and would render the search box as "active" when it isn't.
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

/**
 * Reads the sale/rent filter off the URL.
 *
 * Anything unrecognised means "no filter" rather than an error: this value is
 * whatever someone typed into the address bar. Guarded with `Object.hasOwn`
 * for the usual prototype-chain reason (Known Gotchas #15).
 */
export function parseListingTypeFilter(value: unknown): ListingType | null {
  if (typeof value !== "string") return null;
  if (!Object.hasOwn(ListingType, value)) return null;
  return value as ListingType;
}
