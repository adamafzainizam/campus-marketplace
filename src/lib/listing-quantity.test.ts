import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasMultiple,
  MAX_QUANTITY,
  MIN_QUANTITY,
  quantityLabel,
  validateQuantity,
} from "./listing-quantity.ts";

describe("validateQuantity", () => {
  it("defaults to one when nothing was supplied", () => {
    // The seller never opened the "more than one" control.
    for (const input of [undefined, null, ""]) {
      assert.deepEqual(validateQuantity(input), { ok: true, value: MIN_QUANTITY });
    }
  });

  it("does not let an empty field become zero", () => {
    // Number("") is 0, not NaN — without an explicit check this is exactly how
    // a blank input becomes a listing with none of the item available.
    const result = validateQuantity("");
    assert.equal(result.ok && result.value, 1);
  });

  it("accepts a number typed into the field", () => {
    const result = validateQuantity("5");
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, 5);
  });

  it("accepts a real number as well as a string", () => {
    const result = validateQuantity(7);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, 7);
  });

  it("trims whitespace around the number", () => {
    const result = validateQuantity("  4  ");
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, 4);
  });

  it("rejects zero and negatives", () => {
    for (const input of ["0", "-1", 0, -5]) {
      assert.equal(validateQuantity(input).ok, false, `${input} was accepted`);
    }
  });

  it("rejects fractions", () => {
    for (const input of ["1.5", 2.5]) {
      assert.equal(validateQuantity(input).ok, false, `${input} was accepted`);
    }
  });

  it("rejects text and other nonsense", () => {
    for (const input of ["lots", "3a", "NaN", {}, [], true]) {
      assert.equal(validateQuantity(input).ok, false, `${JSON.stringify(input)} accepted`);
    }
  });

  it("rejects Infinity", () => {
    assert.equal(validateQuantity(Infinity).ok, false);
    assert.equal(validateQuantity("Infinity").ok, false);
  });

  it("accepts exactly the minimum and maximum", () => {
    assert.equal(validateQuantity(MIN_QUANTITY).ok, true);
    assert.equal(validateQuantity(MAX_QUANTITY).ok, true);
  });

  it("rejects one over the maximum", () => {
    assert.equal(validateQuantity(MAX_QUANTITY + 1).ok, false);
  });
});

describe("hasMultiple", () => {
  it("is false for a single item", () => {
    assert.equal(hasMultiple(1), false);
  });

  it("is true for more than one", () => {
    assert.equal(hasMultiple(2), true);
    assert.equal(hasMultiple(MAX_QUANTITY), true);
  });
});

describe("quantityLabel", () => {
  it("says nothing about a single item", () => {
    // "1 available" on every listing is noise.
    assert.equal(quantityLabel(1), null);
  });

  it("reports the count for more than one", () => {
    assert.equal(quantityLabel(3), "3 available");
  });

  it("says 'available', not 'in stock'", () => {
    // No money passes through this site, so it never learns a sale happened
    // and cannot decrement anything. "In stock" would imply a system that
    // knows; "available" describes what the seller told us.
    const label = quantityLabel(4);
    assert.ok(label);
    assert.doesNotMatch(label!, /stock/i);
    assert.match(label!, /available/i);
  });
});
