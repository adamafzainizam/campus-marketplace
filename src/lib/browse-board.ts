/**
 * When the board is too thin to fill itself, and what to do about it.
 * No I/O.
 *
 * Relative imports with explicit extensions if any are ever added — this
 * module is reached by a test (Gotchas #21/#23).
 */

/**
 * Two full desktop rows. Below this the four-column grid renders half a row
 * of content and then a viewport of nothing, which is what "empty and
 * lifeless" actually was — it was diagnosed as chrome-versus-content and
 * treated by reclaiming ninety pixels of filter chips, which measured the
 * wrong thing.
 */
export const SPARSE_BOARD_MAX = 8;

/**
 * Whether the grid should adapt to a thin board: fewer columns, plus an
 * invitation to post in the space that is left.
 *
 * Filtered results are never sparse, however few of them there are. Few
 * results under a filter is information about the filter, and the honest
 * response is "try a broader category", not "post something".
 *
 * A count of zero is technically sparse and never reaches this branch — the
 * page renders its empty-state card instead of a grid. Left in rather than
 * special-cased, so the function matches the rule as specified.
 */
export function isSparseBoard(listingCount: number, filtered: boolean): boolean {
  return !filtered && listingCount < SPARSE_BOARD_MAX;
}
