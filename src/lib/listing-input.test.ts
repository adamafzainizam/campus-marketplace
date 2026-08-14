import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateListingInput } from "./listing-input.ts";

const VALID = {
  title: "Mini fridge",
  description: "A small fridge in good working order, collection from campus.",
  price: "120.00",
  condition: "GOOD",
  categoryId: "cmsoke91m0001jj9y3su5gika",
  type: "SALE",
  rentalPeriod: undefined,
};

describe("validateListingInput", () => {
  it("returns every field when the input is sound", () => {
    const result = validateListingInput(VALID);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.title, "Mini fridge");
    assert.equal(result.value.price, "120.00");
    assert.equal(result.value.type, "SALE");
    assert.equal(result.value.rentalPeriod, null);
  });

  it("carries the rental period through for a rental", () => {
    const result = validateListingInput({ ...VALID, type: "RENT", rentalPeriod: "WEEK" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.rentalPeriod, "WEEK");
  });

  it("discards a rental period supplied on a sale", () => {
    const result = validateListingInput({ ...VALID, type: "SALE", rentalPeriod: "WEEK" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.rentalPeriod, null);
  });

  it("reports the first failing field", () => {
    const result = validateListingInput({ ...VALID, title: "no" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /Title/);
  });

  it("rejects a non-object payload without throwing", () => {
    for (const value of [undefined, null, "string", 42, []]) {
      const result = validateListingInput(value);
      // An array is an object, so it fails on its missing fields rather than
      // on the shape check — either way it must fail, and must not throw.
      assert.equal(result.ok, false, `${String(value)} must be rejected`);
    }
  });

  // The reason this module exists: create and edit must not drift. Anything
  // create rejects, edit must reject identically, because both call this.
  it("applies the same rules whatever produced the payload", () => {
    const tooShort = { ...VALID, description: "." };
    const first = validateListingInput(tooShort);
    const second = validateListingInput({ ...tooShort });
    assert.deepEqual(first, second);
    assert.equal(first.ok, false);
  });
});
