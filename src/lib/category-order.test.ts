import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  categoryDisplayName,
  isOtherCategorySlug,
  MAX_OTHER_CATEGORY_LENGTH,
  MIN_OTHER_CATEGORY_LENGTH,
  OTHER_CATEGORY_SLUG,
  sortCategoriesForDisplay,
  validateOtherCategory,
} from "./category-order.ts";

const cat = (name: string, slug: string) => ({ id: `id-${slug}`, name, slug });

describe("sortCategoriesForDisplay", () => {
  it("sorts alphabetically", () => {
    const sorted = sortCategoriesForDisplay([
      cat("Furniture", "furniture"),
      cat("Books", "books"),
      cat("Electronics", "electronics"),
    ]);
    assert.deepEqual(sorted.map((c) => c.name), [
      "Books",
      "Electronics",
      "Furniture",
    ]);
  });

  it("pins the catch-all to the bottom, out of alphabetical order", () => {
    // "Other" sorts between Furniture and Sports naturally, which is the bug.
    const sorted = sortCategoriesForDisplay([
      cat("Sports", "sports"),
      cat("Other", OTHER_CATEGORY_SLUG),
      cat("Books", "books"),
      cat("Furniture", "furniture"),
    ]);
    assert.deepEqual(sorted.map((c) => c.name), [
      "Books",
      "Furniture",
      "Sports",
      "Other",
    ]);
  });

  it("matches on slug, not on the label", () => {
    // Renaming the label must not move it back into the alphabet.
    const sorted = sortCategoriesForDisplay([
      cat("Zebras", "zebras"),
      cat("Something else", OTHER_CATEGORY_SLUG),
    ]);
    assert.equal(sorted.at(-1)?.slug, OTHER_CATEGORY_SLUG);
  });

  it("is not confused by a category merely named 'Other'", () => {
    const sorted = sortCategoriesForDisplay([
      cat("Other", "not-the-catch-all"),
      cat("Books", "books"),
    ]);
    // Sorted alphabetically, because its slug is not the catch-all.
    assert.deepEqual(sorted.map((c) => c.name), ["Books", "Other"]);
  });

  it("does not mutate its input", () => {
    // getCategories hands out a cached array; sorting in place would reorder a
    // value other callers already hold.
    const input = [cat("Other", OTHER_CATEGORY_SLUG), cat("Books", "books")];
    const before = input.map((c) => c.slug);
    sortCategoriesForDisplay(input);
    assert.deepEqual(input.map((c) => c.slug), before);
  });

  it("handles an empty list and a single item", () => {
    assert.deepEqual(sortCategoriesForDisplay([]), []);
    const one = [cat("Books", "books")];
    assert.deepEqual(sortCategoriesForDisplay(one).map((c) => c.slug), ["books"]);
  });
});

describe("isOtherCategorySlug", () => {
  it("recognises the catch-all", () => {
    assert.equal(isOtherCategorySlug(OTHER_CATEGORY_SLUG), true);
  });

  it("rejects everything else, including non-strings", () => {
    for (const input of ["books", "Other", "OTHER", null, undefined, 0, {}]) {
      assert.equal(isOtherCategorySlug(input), false);
    }
  });
});

describe("validateOtherCategory", () => {
  it("requires text when the catch-all is selected", () => {
    assert.equal(validateOtherCategory(undefined, true).ok, false);
    assert.equal(validateOtherCategory("", true).ok, false);
    assert.equal(validateOtherCategory("   ", true).ok, false);
  });

  it("accepts and trims a sensible answer", () => {
    const result = validateOtherCategory("  Bicycle parts  ", true);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, "Bicycle parts");
  });

  it("discards anything supplied when the catch-all is NOT selected", () => {
    // Discarding rather than ignoring: a crafted payload must not be able to
    // attach a category note to a listing filed elsewhere.
    const result = validateOtherCategory("Textbooks (unopened)", false);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, null);
  });

  it("still succeeds with nothing supplied and the catch-all not selected", () => {
    assert.deepEqual(validateOtherCategory(undefined, false), {
      ok: true,
      value: null,
    });
  });

  it("rejects an answer too short to mean anything", () => {
    assert.equal(
      validateOtherCategory("x".repeat(MIN_OTHER_CATEGORY_LENGTH - 1), true).ok,
      false,
    );
  });

  it("accepts exactly the minimum and maximum", () => {
    assert.equal(
      validateOtherCategory("x".repeat(MIN_OTHER_CATEGORY_LENGTH), true).ok,
      true,
    );
    assert.equal(
      validateOtherCategory("x".repeat(MAX_OTHER_CATEGORY_LENGTH), true).ok,
      true,
    );
  });

  it("rejects one character over the maximum", () => {
    assert.equal(
      validateOtherCategory("x".repeat(MAX_OTHER_CATEGORY_LENGTH + 1), true).ok,
      false,
    );
  });

  it("measures length after trimming", () => {
    assert.equal(validateOtherCategory("  a  ", true).ok, false);
  });

  it("rejects non-strings when the catch-all is selected", () => {
    for (const input of [42, {}, [], true, null]) {
      assert.equal(validateOtherCategory(input, true).ok, false);
    }
  });
});

describe("categoryDisplayName", () => {
  it("shows the plain name for an ordinary category", () => {
    assert.equal(categoryDisplayName("Books", "books", null), "Books");
  });

  it("ignores stray detail on an ordinary category", () => {
    assert.equal(categoryDisplayName("Books", "books", "Anything"), "Books");
  });

  it("shows what the seller said for the catch-all", () => {
    assert.equal(
      categoryDisplayName("Other", OTHER_CATEGORY_SLUG, "Bicycle parts"),
      "Other — Bicycle parts",
    );
  });

  it("falls back to the plain name when nothing was said", () => {
    assert.equal(categoryDisplayName("Other", OTHER_CATEGORY_SLUG, null), "Other");
    assert.equal(categoryDisplayName("Other", OTHER_CATEGORY_SLUG, "   "), "Other");
  });
});
