import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SELLER_SELECTABLE_STATUSES,
  isPubliclyVisible,
  statusLabel,
  validateListingStatus,
} from "./listing-status.ts";
import { ListingStatus, ListingType } from "../generated/prisma/enums.ts";

describe("statusLabel", () => {
  // The whole reason this is a function and not a lookup table: the state is
  // the same, the vocabulary isn't. A rental marked "Sold" reads as a mistake.
  it("says Sold for a sale and Rented out for a rental", () => {
    assert.equal(statusLabel("SOLD", "SALE"), "Sold");
    assert.equal(statusLabel("SOLD", "RENT"), "Rented out");
  });

  it("uses the same words for the states that don't differ", () => {
    for (const type of Object.values(ListingType)) {
      assert.equal(statusLabel("AVAILABLE", type), "Available");
      assert.equal(statusLabel("RESERVED", type), "Reserved");
      assert.equal(statusLabel("ARCHIVED", type), "Archived");
    }
  });

  it("labels every status for every type", () => {
    for (const status of Object.values(ListingStatus)) {
      for (const type of Object.values(ListingType)) {
        const label = statusLabel(status, type);
        assert.ok(label.length > 0, `no label for ${status}/${type}`);
        assert.ok(!label.includes("undefined"), `bad label for ${status}/${type}: ${label}`);
      }
    }
  });
});

describe("isPubliclyVisible", () => {
  // Sold and reserved listings stay on the browse page, marked — it shows a
  // visitor the marketplace is actually used. Archived is the seller
  // withdrawing the listing, so it goes.
  it("keeps available, reserved and sold on the browse page", () => {
    assert.equal(isPubliclyVisible("AVAILABLE"), true);
    assert.equal(isPubliclyVisible("RESERVED"), true);
    assert.equal(isPubliclyVisible("SOLD"), true);
  });

  it("hides archived listings", () => {
    assert.equal(isPubliclyVisible("ARCHIVED"), false);
  });

  it("classifies every status, so a new one can't silently default to visible", () => {
    const visible = Object.values(ListingStatus).filter(isPubliclyVisible);
    assert.deepEqual(visible.sort(), ["AVAILABLE", "RESERVED", "SOLD"]);
  });
});

describe("SELLER_SELECTABLE_STATUSES", () => {
  it("offers every status the seller is allowed to set", () => {
    assert.deepEqual([...SELLER_SELECTABLE_STATUSES].sort(), [
      "ARCHIVED",
      "AVAILABLE",
      "RESERVED",
      "SOLD",
    ]);
  });
});

describe("validateListingStatus", () => {
  it("accepts each real status", () => {
    for (const status of Object.values(ListingStatus)) {
      assert.deepEqual(validateListingStatus(status), { ok: true, value: status });
    }
  });

  it("rejects an unknown status", () => {
    assert.equal(validateListingStatus("DELETED").ok, false);
    assert.equal(validateListingStatus("available").ok, false);
  });

  // Known Gotchas #15.
  it("rejects inherited keys from the prototype chain", () => {
    for (const key of ["constructor", "toString", "valueOf", "hasOwnProperty"]) {
      assert.equal(validateListingStatus(key).ok, false, `${key} must be rejected`);
    }
  });

  it("rejects non-string input", () => {
    for (const value of [undefined, null, 42, {}, ["SOLD"]]) {
      assert.equal(validateListingStatus(value).ok, false);
    }
  });
});
