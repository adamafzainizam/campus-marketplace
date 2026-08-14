/**
 * Tests for listing-creation rules.
 *
 * Relative import with an explicit `.ts` extension — see Known Gotchas #21.
 * The module under test imports the generated Prisma enums the same way, for
 * the same reason: the `@/` alias fails under `node --test` even transitively.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  validateCondition,
  validateDescription,
  validateId,
  validateListingType,
  validatePrice,
  validateRentalPeriod,
  validateTitle,
} from "./listing-constraints.ts";

/** The hostile shapes a direct POST can supply where a string is expected. */
const NON_STRINGS = [null, undefined, 42, 0, true, false, {}, [], ["x"]];

describe("validateTitle", () => {
  it("accepts a reasonable title and trims it", () => {
    const result = validateTitle("  TI-84 Calculator  ");
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, "TI-84 Calculator");
  });

  // Regression test for audit finding S3. The previous inline version called
  // input.title.trim() before establishing that title was a string, so a POST
  // of {"title": null} produced an unhandled TypeError and a 500 rather than a
  // clean rejection.
  it("rejects non-string input without throwing", () => {
    for (const value of NON_STRINGS) {
      assert.doesNotThrow(() => validateTitle(value));
      assert.equal(
        validateTitle(value).ok,
        false,
        `expected ${JSON.stringify(value)} to be rejected`,
      );
    }
  });

  it("enforces length bounds after trimming", () => {
    assert.equal(validateTitle("ab").ok, false);
    assert.equal(validateTitle("  ab  ").ok, false);
    assert.equal(validateTitle("abc").ok, true);
    assert.equal(validateTitle("x".repeat(TITLE_MAX_LENGTH)).ok, true);
    assert.equal(validateTitle("x".repeat(TITLE_MAX_LENGTH + 1)).ok, false);
  });

  it("rejects whitespace-only titles", () => {
    assert.equal(validateTitle("     ").ok, false);
    assert.equal(validateTitle("\n\t ").ok, false);
  });
});

describe("validateDescription", () => {
  it("accepts and trims", () => {
    const result = validateDescription("  Barely used, includes case.  ");
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, "Barely used, includes case.");
  });

  it("rejects non-string input without throwing", () => {
    for (const value of NON_STRINGS) {
      assert.doesNotThrow(() => validateDescription(value));
      assert.equal(validateDescription(value).ok, false);
    }
  });

  it("enforces length bounds", () => {
    assert.equal(validateDescription("too short").ok, false);
    assert.equal(validateDescription("just enough!").ok, true);
    assert.equal(validateDescription("x".repeat(DESCRIPTION_MAX_LENGTH)).ok, true);
    assert.equal(
      validateDescription("x".repeat(DESCRIPTION_MAX_LENGTH + 1)).ok,
      false,
    );
  });
});

describe("validatePrice", () => {
  it("accepts plain and two-decimal prices", () => {
    for (const price of ["1", "10", "99.99", "0.01", "12345678", "5.5"]) {
      assert.equal(validatePrice(price).ok, true, `expected ${price} to pass`);
    }
  });

  it("rejects non-string input without throwing", () => {
    for (const value of NON_STRINGS) {
      assert.doesNotThrow(() => validatePrice(value));
      assert.equal(validatePrice(value).ok, false);
    }
  });

  // Prices are kept as strings all the way to Prisma's Decimal(10,2). A number
  // that only *looks* valid after coercion must not slip through.
  it("rejects values that are not plain decimal strings", () => {
    for (const price of [
      "1e5",
      "0x10",
      "-5",
      "+5",
      "5 5",
      ".5",
      "5.",
      "5.123",
      "123456789",
      "Infinity",
      "NaN",
      "5,00",
      "",
      "RM5",
    ]) {
      assert.equal(
        validatePrice(price).ok,
        false,
        `expected ${JSON.stringify(price)} to be rejected`,
      );
    }
  });

  // Surrounding whitespace is trimmed before the pattern is applied,
  // consistently with validateTitle and validateDescription. Worth pinning:
  // String.trim() strips Unicode whitespace including non-breaking spaces, so
  // " 5 " is a valid price, not a rejected one.
  it("trims surrounding whitespace, including non-breaking spaces", () => {
    const padded = validatePrice("  5.00  ");
    assert.equal(padded.ok, true);
    assert.equal(padded.ok && padded.value, "5.00");

    const nbsp = validatePrice(" 5 ");
    assert.equal(nbsp.ok, true);
    assert.equal(nbsp.ok && nbsp.value, "5");
  });

  it("rejects zero and effectively-zero prices", () => {
    assert.equal(validatePrice("0").ok, false);
    assert.equal(validatePrice("0.00").ok, false);
  });
});

describe("validateCondition", () => {
  it("accepts every schema enum value", () => {
    for (const condition of ["NEW", "LIKE_NEW", "GOOD", "FAIR", "WORN"]) {
      assert.equal(validateCondition(condition).ok, true, condition);
    }
  });

  // Same prototype-chain bypass as Known Gotchas #15, in a second allowlist.
  // Without Object.hasOwn these inherited keys resolve to truthy functions.
  it("rejects keys inherited from Object.prototype", () => {
    for (const inherited of [
      "constructor",
      "toString",
      "valueOf",
      "hasOwnProperty",
      "__proto__",
    ]) {
      assert.equal(
        validateCondition(inherited).ok,
        false,
        `expected "${inherited}" to be rejected`,
      );
    }
  });

  it("rejects unknown values, wrong casing, and non-strings", () => {
    assert.equal(validateCondition("BRAND_NEW").ok, false);
    assert.equal(validateCondition("good").ok, false);
    for (const value of NON_STRINGS) {
      assert.doesNotThrow(() => validateCondition(value));
      assert.equal(validateCondition(value).ok, false);
    }
  });
});

describe("validateId", () => {
  it("accepts a cuid-shaped id", () => {
    const result = validateId("cmsliiije00000a9y6absvagz", "Category");
    assert.equal(result.ok, true);
  });

  it("rejects non-string input without throwing", () => {
    for (const value of NON_STRINGS) {
      assert.doesNotThrow(() => validateId(value, "Category"));
      assert.equal(validateId(value, "Category").ok, false);
    }
  });

  it("rejects ids carrying separators or traversal", () => {
    for (const id of [
      "",
      "   ",
      "../../etc/passwd",
      "abc/def",
      "abc def",
      "abc:def",
      "abc*",
      "'; DROP TABLE listings;--",
      "x".repeat(65),
    ]) {
      assert.equal(
        validateId(id, "Category").ok,
        false,
        `expected ${JSON.stringify(id)} to be rejected`,
      );
    }
  });

  it("names the field in its error message", () => {
    const result = validateId(null, "Conversation");
    assert.equal(result.ok, false);
    assert.match(result.ok === false ? result.error : "", /Conversation/);
  });
});

describe("validateListingType", () => {
  it("accepts both kinds of listing", () => {
    assert.deepEqual(validateListingType("SALE"), { ok: true, value: "SALE" });
    assert.deepEqual(validateListingType("RENT"), { ok: true, value: "RENT" });
  });

  it("rejects an unknown type", () => {
    assert.equal(validateListingType("LEASE").ok, false);
    assert.equal(validateListingType("sale").ok, false);
  });

  // Known Gotchas #15: an allowlist keyed by user input is bypassable through
  // the prototype chain unless guarded with Object.hasOwn.
  it("rejects inherited keys from the prototype chain", () => {
    for (const key of ["constructor", "toString", "valueOf", "hasOwnProperty"]) {
      assert.equal(validateListingType(key).ok, false, `${key} must be rejected`);
    }
  });

  it("rejects non-string input", () => {
    for (const value of [undefined, null, 42, {}, ["SALE"]]) {
      assert.equal(validateListingType(value).ok, false);
    }
  });
});

describe("validateRentalPeriod", () => {
  // A rental price without a unit is meaningless: "RM20" could be a day or a
  // semester. The period is therefore required for RENT.
  it("requires a period when the listing is a rental", () => {
    assert.equal(validateRentalPeriod(undefined, "RENT").ok, false);
    assert.equal(validateRentalPeriod("", "RENT").ok, false);
    assert.deepEqual(validateRentalPeriod("WEEK", "RENT"), { ok: true, value: "WEEK" });
    assert.deepEqual(validateRentalPeriod("SEMESTER", "RENT"), { ok: true, value: "SEMESTER" });
  });

  // A sale has no period. Anything supplied is discarded rather than stored,
  // so a crafted payload cannot leave a sale displaying "RM20 / week".
  it("stores null for a sale, whatever was submitted", () => {
    assert.deepEqual(validateRentalPeriod(undefined, "SALE"), { ok: true, value: null });
    assert.deepEqual(validateRentalPeriod("WEEK", "SALE"), { ok: true, value: null });
    assert.deepEqual(validateRentalPeriod("nonsense", "SALE"), { ok: true, value: null });
  });

  it("rejects an unknown period on a rental", () => {
    assert.equal(validateRentalPeriod("FORTNIGHT", "RENT").ok, false);
    assert.equal(validateRentalPeriod("week", "RENT").ok, false);
  });

  it("rejects inherited keys from the prototype chain on a rental", () => {
    for (const key of ["constructor", "toString", "valueOf"]) {
      assert.equal(validateRentalPeriod(key, "RENT").ok, false, `${key} must be rejected`);
    }
  });
});
