import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HalalStatus } from "../generated/prisma/enums.ts";
import {
  FOOD_CATEGORY_SLUG,
  HALAL_NOT_VERIFIED,
  HALAL_STATUSES,
  halalDisplayLabel,
  halalOptionHint,
  halalOptionLabel,
  isFoodCategorySlug,
  validateHalalStatus,
} from "./halal.ts";

describe("isFoodCategorySlug", () => {
  it("recognises the food category", () => {
    assert.equal(isFoodCategorySlug(FOOD_CATEGORY_SLUG), true);
  });

  it("rejects everything else, including non-strings", () => {
    for (const input of ["food", "Food & Drink", "books", null, undefined, 0, {}]) {
      assert.equal(isFoodCategorySlug(input), false);
    }
  });
});

describe("HALAL_STATUSES", () => {
  it("offers every value the database allows", () => {
    assert.deepEqual([...HALAL_STATUSES].sort(), Object.values(HalalStatus).sort());
  });

  it("puts declining to claim last, not first", () => {
    // Otherwise it becomes the path of least resistance.
    assert.equal(HALAL_STATUSES.at(-1), HalalStatus.UNSPECIFIED);
  });

  it("labels and hints every option distinctly", () => {
    const labels = Object.values(HalalStatus).map(halalOptionLabel);
    assert.equal(new Set(labels).size, labels.length);
    for (const status of Object.values(HalalStatus)) {
      assert.ok(halalOptionLabel(status).length > 0);
      assert.ok(halalOptionHint(status).length > 0);
      assert.notEqual(halalOptionLabel(status), "undefined");
    }
  });
});

describe("halalDisplayLabel", () => {
  it("attributes every claim to the seller, never stating it as fact", () => {
    // The governing rule of this module. A bare "Halal" would present an
    // unverified assertion about a religious restriction as established fact.
    for (const status of Object.values(HalalStatus)) {
      const label = halalDisplayLabel(status);
      assert.ok(label, `${status} has no display label`);
      assert.match(
        label!,
        /seller/i,
        `${status} renders as "${label}" without attributing it to the seller`,
      );
    }
  });

  it("never renders a bare 'Halal'", () => {
    assert.notEqual(halalDisplayLabel(HalalStatus.HALAL), "Halal");
  });

  it("distinguishes halal, not halal, and not said", () => {
    const labels = Object.values(HalalStatus).map(halalDisplayLabel);
    assert.equal(new Set(labels).size, labels.length);
  });

  it("says nothing when there is nothing to say", () => {
    // Non-food listings carry null and must render no halal line at all.
    assert.equal(halalDisplayLabel(null), null);
  });
});

describe("HALAL_NOT_VERIFIED", () => {
  it("states that nothing is certified or checked", () => {
    assert.match(HALAL_NOT_VERIFIED, /not.*certified|certified.*|checked/i);
    assert.match(HALAL_NOT_VERIFIED, /seller/i);
  });
});

describe("validateHalalStatus", () => {
  it("requires a choice for food", () => {
    assert.equal(validateHalalStatus(undefined, true).ok, false);
    assert.equal(validateHalalStatus("", true).ok, false);
    assert.equal(validateHalalStatus(null, true).ok, false);
  });

  it("accepts each real value for food", () => {
    for (const status of Object.values(HalalStatus)) {
      const result = validateHalalStatus(status, true);
      assert.equal(result.ok, true, `${status} was rejected`);
      assert.equal(result.ok && result.value, status);
    }
  });

  it("accepts UNSPECIFIED, so 'required' never forces a false claim", () => {
    const result = validateHalalStatus(HalalStatus.UNSPECIFIED, true);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, HalalStatus.UNSPECIFIED);
  });

  it("discards anything supplied for a non-food listing", () => {
    // A crafted payload must not be able to attach "seller says halal" to a
    // bicycle, or to food filed under another category.
    const result = validateHalalStatus(HalalStatus.HALAL, false);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, null);
  });

  it("rejects an unknown value for food", () => {
    assert.equal(validateHalalStatus("SORT_OF", true).ok, false);
    assert.equal(validateHalalStatus("halal", true).ok, false);
  });

  it("is not fooled by inherited object properties", () => {
    // Gotcha #15 — a bare lookup resolves these off Object.prototype.
    for (const key of ["constructor", "toString", "valueOf", "hasOwnProperty"]) {
      assert.equal(validateHalalStatus(key, true).ok, false, `${key} accepted`);
    }
  });

  it("rejects non-strings for food", () => {
    for (const input of [42, {}, [], true]) {
      assert.equal(validateHalalStatus(input, true).ok, false);
    }
  });
});
