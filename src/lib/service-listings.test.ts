import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ListingCondition,
  ListingType,
  ServiceRate,
} from "../generated/prisma/enums.ts";
import {
  validateCondition,
  validateServiceRate,
} from "./listing-constraints.ts";
import {
  formatPrice,
  LISTING_TYPE_LABELS,
  SERVICE_RATE_LABELS,
} from "./listing-labels.ts";
import { statusLabel } from "./listing-status.ts";

describe("validateCondition — contextual on listing type", () => {
  it("requires a condition for a sale", () => {
    assert.equal(validateCondition(undefined, ListingType.SALE).ok, false);
    const ok = validateCondition(ListingCondition.GOOD, ListingType.SALE);
    assert.equal(ok.ok && ok.value, ListingCondition.GOOD);
  });

  it("requires a condition for a rental", () => {
    assert.equal(validateCondition(undefined, ListingType.RENT).ok, false);
    const ok = validateCondition(ListingCondition.FAIR, ListingType.RENT);
    assert.equal(ok.ok && ok.value, ListingCondition.FAIR);
  });

  it("does not require one for a service", () => {
    // An hour of somebody's time has no condition.
    const result = validateCondition(undefined, ListingType.SERVICE);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, null);
  });

  it("DISCARDS a condition submitted with a service", () => {
    // Not merely ignored: without this a crafted payload leaves a tutoring
    // listing advertised as "Like new".
    const result = validateCondition(ListingCondition.NEW, ListingType.SERVICE);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, null);
  });

  it("still rejects a bogus condition on a sale", () => {
    assert.equal(validateCondition("PRISTINE", ListingType.SALE).ok, false);
  });

  it("is not fooled by inherited object properties", () => {
    for (const key of ["constructor", "toString", "hasOwnProperty"]) {
      assert.equal(validateCondition(key, ListingType.SALE).ok, false, key);
    }
  });
});

describe("validateServiceRate — contextual on listing type", () => {
  it("requires a rate for a service", () => {
    assert.equal(validateServiceRate(undefined, ListingType.SERVICE).ok, false);
    assert.equal(validateServiceRate("", ListingType.SERVICE).ok, false);
  });

  it("accepts every real rate for a service", () => {
    for (const rate of Object.values(ServiceRate)) {
      const result = validateServiceRate(rate, ListingType.SERVICE);
      assert.equal(result.ok, true, `${rate} rejected`);
      assert.equal(result.ok && result.value, rate);
    }
  });

  it("DISCARDS a rate submitted with a sale or a rental", () => {
    // Otherwise a sale could render as "RM 30 / hour".
    for (const type of [ListingType.SALE, ListingType.RENT]) {
      const result = validateServiceRate(ServiceRate.HOUR, type);
      assert.equal(result.ok, true);
      assert.equal(result.ok && result.value, null);
    }
  });

  it("rejects an unknown rate for a service", () => {
    assert.equal(validateServiceRate("PER_MOON", ListingType.SERVICE).ok, false);
    assert.equal(validateServiceRate("hour", ListingType.SERVICE).ok, false);
  });

  it("is not fooled by inherited object properties", () => {
    for (const key of ["constructor", "toString", "valueOf"]) {
      assert.equal(validateServiceRate(key, ListingType.SERVICE).ok, false, key);
    }
  });
});

describe("formatPrice for services", () => {
  it("appends the rate", () => {
    assert.equal(
      formatPrice("30.00", ListingType.SERVICE, null, ServiceRate.HOUR),
      "RM 30.00 / hour",
    );
    assert.equal(
      formatPrice("50.00", ListingType.SERVICE, null, ServiceRate.SESSION),
      "RM 50.00 / session",
    );
  });

  it("says nothing after a fixed price", () => {
    // "RM 80" is the whole statement for a whole job; "/ fixed" reads worse.
    assert.equal(
      formatPrice("80.00", ListingType.SERVICE, null, ServiceRate.FIXED),
      "RM 80.00",
    );
  });

  it("falls back to a bare price when the rate is missing", () => {
    // The data would be wrong, but the page should not render "/ undefined".
    assert.equal(formatPrice("30.00", ListingType.SERVICE, null, null), "RM 30.00");
  });

  it("does not leak a service rate onto a sale or a rental", () => {
    assert.equal(
      formatPrice("30.00", ListingType.SALE, null, ServiceRate.HOUR),
      "RM 30.00",
    );
    assert.equal(
      formatPrice("30.00", ListingType.RENT, null, ServiceRate.HOUR),
      "RM 30.00",
    );
  });

  it("still formats rentals as before", () => {
    assert.equal(
      formatPrice("20.00", ListingType.RENT, "WEEK", null),
      "RM 20.00 / week",
    );
  });

  it("remains callable without the new argument", () => {
    // The parameter is optional so existing call sites keep working.
    assert.equal(formatPrice("15.00", ListingType.SALE, null), "RM 15.00");
  });
});

describe("labels", () => {
  it("labels every listing type, including services", () => {
    for (const type of Object.values(ListingType)) {
      assert.ok(LISTING_TYPE_LABELS[type]?.length > 0, `${type} has no label`);
    }
  });

  it("gives FIXED an empty rate label on purpose", () => {
    assert.equal(SERVICE_RATE_LABELS[ServiceRate.FIXED], "");
  });

  it("labels the other rates", () => {
    for (const rate of Object.values(ServiceRate)) {
      if (rate === ServiceRate.FIXED) continue;
      assert.ok(SERVICE_RATE_LABELS[rate].length > 0, `${rate} has no label`);
    }
  });
});

describe("statusLabel for services", () => {
  it("says a service is no longer offered rather than sold", () => {
    assert.equal(statusLabel("SOLD", ListingType.SERVICE), "No longer offered");
  });

  it("keeps the existing wording for sales and rentals", () => {
    assert.equal(statusLabel("SOLD", ListingType.SALE), "Sold");
    assert.equal(statusLabel("SOLD", ListingType.RENT), "Rented out");
  });

  it("gives every status a label for every type", () => {
    for (const status of ["AVAILABLE", "RESERVED", "SOLD", "ARCHIVED"] as const) {
      for (const type of Object.values(ListingType)) {
        const label = statusLabel(status, type);
        assert.ok(label.length > 0, `${status}/${type} has no label`);
        assert.notEqual(label, "undefined");
      }
    }
  });
});
