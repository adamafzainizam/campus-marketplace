import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CONDITION_LABELS,
  LISTING_TYPE_LABELS,
  RENTAL_PERIOD_LABELS,
  formatPrice,
} from "./listing-labels.ts";
import {
  ListingCondition,
  ListingType,
  RentalPeriod,
} from "../generated/prisma/enums.ts";

describe("label maps cover every enum value", () => {
  // A missing entry renders as "undefined" in the UI rather than failing, so
  // this is checked mechanically instead of by eye.
  it("labels every condition", () => {
    for (const value of Object.keys(ListingCondition)) {
      assert.ok(
        CONDITION_LABELS[value as ListingCondition],
        `no label for condition ${value}`,
      );
    }
  });

  it("labels every listing type", () => {
    for (const value of Object.keys(ListingType)) {
      assert.ok(LISTING_TYPE_LABELS[value as ListingType], `no label for type ${value}`);
    }
  });

  it("labels every rental period", () => {
    for (const value of Object.keys(RentalPeriod)) {
      assert.ok(
        RENTAL_PERIOD_LABELS[value as RentalPeriod],
        `no label for period ${value}`,
      );
    }
  });
});

describe("formatPrice", () => {
  it("renders a sale price on its own", () => {
    assert.equal(formatPrice("25.00", "SALE", null), "RM 25.00");
  });

  // The unit is the whole point for a rental: "RM20" alone could mean a day
  // or a semester.
  it("renders a rental price with its period", () => {
    assert.equal(formatPrice("20.00", "RENT", "WEEK"), "RM 20.00 / week");
    assert.equal(formatPrice("150.00", "RENT", "SEMESTER"), "RM 150.00 / semester");
  });

  it("ignores a period on a sale", () => {
    assert.equal(formatPrice("25.00", "SALE", "WEEK"), "RM 25.00");
  });

  // Defensive: a rental row whose period is somehow null must still render a
  // sensible price rather than "RM 20.00 / undefined".
  it("falls back gracefully when a rental has no period", () => {
    assert.equal(formatPrice("20.00", "RENT", null), "RM 20.00");
  });

  it("accepts the Decimal-like objects Prisma returns", () => {
    const decimalish = { toString: () => "12.50" };
    assert.equal(formatPrice(decimalish, "SALE", null), "RM 12.50");
  });
});
