import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ABSOLUTE_DATE_AFTER_DAYS,
  CONDITION_LABELS,
  LISTING_TYPE_LABELS,
  RENTAL_PERIOD_LABELS,
  formatPrice,
  postedAgo,
  priceParts,
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

describe("postedAgo", () => {
  const now = new Date("2026-08-16T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  // Under an hour is "just now" rather than "0h ago", which reads like a bug.
  it("says just now under an hour", () => {
    assert.equal(postedAgo(now, now), "just now");
    assert.equal(postedAgo(ago(59 * MINUTE), now), "just now");
  });

  it("counts whole hours up to a day", () => {
    assert.equal(postedAgo(ago(HOUR), now), "1h ago");
    assert.equal(postedAgo(ago(5 * HOUR), now), "5h ago");
    assert.equal(postedAgo(ago(23 * HOUR + 59 * MINUTE), now), "23h ago");
  });

  it("counts whole days up to a week", () => {
    assert.equal(postedAgo(ago(DAY), now), "1d ago");
    assert.equal(postedAgo(ago(6 * DAY + 23 * HOUR), now), "6d ago");
  });

  it("counts whole weeks up to the absolute-date cutoff", () => {
    assert.equal(postedAgo(ago(7 * DAY), now), "1w ago");
    assert.equal(postedAgo(ago(21 * DAY), now), "3w ago");
    assert.equal(postedAgo(ago(55 * DAY), now), "7w ago");
  });

  // Past about two months "9w ago" stops being useful and a date is kinder.
  it("gives an absolute date beyond the cutoff", () => {
    assert.equal(postedAgo(ago(ABSOLUTE_DATE_AFTER_DAYS * DAY), now), "21 Jun 2026");
    assert.equal(postedAgo(new Date("2025-12-31T08:00:00Z"), now), "31 Dec 2025");
  });

  // A listing dated in the future means a clock is wrong somewhere. Saying
  // "just now" is the least wrong thing to render; "-3h ago" is nonsense.
  it("clamps a future date rather than counting backwards", () => {
    assert.equal(postedAgo(new Date("2026-08-17T12:00:00Z"), now), "just now");
  });
});

describe("priceParts", () => {
  it("gives a sale price no unit", () => {
    assert.deepEqual(priceParts("25.00", "SALE", null), {
      amount: "RM 25.00",
      unit: null,
    });
  });

  it("splits a rental into amount and unit", () => {
    assert.deepEqual(priceParts("20.00", "RENT", "WEEK"), {
      amount: "RM 20.00",
      unit: "/ week",
    });
  });

  it("splits a service into amount and rate", () => {
    assert.deepEqual(priceParts("30.00", "SERVICE", null, "HOUR"), {
      amount: "RM 30.00",
      unit: "/ hour",
    });
  });

  // FIXED maps to an empty label on purpose: "RM 80" is the whole statement
  // for a whole job, so there must be no unit element to style at all.
  it("gives a fixed-rate service no unit", () => {
    assert.deepEqual(priceParts("80.00", "SERVICE", null, "FIXED"), {
      amount: "RM 80.00",
      unit: null,
    });
  });

  it("falls back to no unit when a rental has no period", () => {
    assert.deepEqual(priceParts("20.00", "RENT", null), {
      amount: "RM 20.00",
      unit: null,
    });
  });

  // The joined string is what every existing caller uses, so the two must not
  // be able to drift: one is defined in terms of the other, and this checks it.
  it("agrees with formatPrice", () => {
    const cases: Array<Parameters<typeof formatPrice>> = [
      ["25.00", "SALE", null, null],
      ["20.00", "RENT", "WEEK", null],
      ["150.00", "RENT", "SEMESTER", null],
      ["30.00", "SERVICE", null, "HOUR"],
      ["80.00", "SERVICE", null, "FIXED"],
    ];
    for (const args of cases) {
      const { amount, unit } = priceParts(...args);
      assert.equal(formatPrice(...args), unit ? `${amount} ${unit}` : amount);
    }
  });
});
