import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PREVIEW_DESCRIPTION_MAX,
  listingPreview,
  truncateForPreview,
  type ListingPreviewInput,
} from "./link-preview.ts";

const base: ListingPreviewInput = {
  title: "Casio fx-570EX",
  description: "Used for one semester. Comes with the cover.",
  status: "AVAILABLE",
  sellerSuspended: false,
  amount: "RM 45",
  unit: null,
  imageUrl: "https://pub-example.r2.dev/listings/u/1.jpg",
};

describe("listingPreview", () => {
  it("leads the description with the price", () => {
    const preview = listingPreview(base);
    assert.equal(preview?.title, "Casio fx-570EX");
    assert.equal(
      preview?.description,
      "RM 45. Used for one semester. Comes with the cover.",
    );
    assert.equal(preview?.imageUrl, base.imageUrl);
  });

  it("keeps the rental or service unit with the price", () => {
    const preview = listingPreview({ ...base, amount: "RM 20", unit: "/ week" });
    assert.ok(preview?.description.startsWith("RM 20 / week. "));
  });

  it("passes through a listing with no photo, so the site card is used", () => {
    assert.equal(listingPreview({ ...base, imageUrl: null })?.imageUrl, null);
  });

  // Mirrors what browse shows: sold and reserved stay visible there.
  it("builds a preview for sold and reserved listings", () => {
    assert.ok(listingPreview({ ...base, status: "SOLD" }));
    assert.ok(listingPreview({ ...base, status: "RESERVED" }));
  });

  it("builds no preview for an archived listing", () => {
    assert.equal(listingPreview({ ...base, status: "ARCHIVED" }), null);
  });

  it("builds no preview when the seller is suspended", () => {
    assert.equal(listingPreview({ ...base, sellerSuspended: true }), null);
  });
});

describe("truncateForPreview", () => {
  it("leaves short text alone, with whitespace flattened", () => {
    assert.equal(truncateForPreview("a\n\n  b"), "a b");
  });

  it("cuts long text on a word, within the limit, with an ellipsis", () => {
    const long = "word ".repeat(80);
    const out = truncateForPreview(long);
    assert.ok(out.length <= PREVIEW_DESCRIPTION_MAX, `${out.length}`);
    assert.ok(out.endsWith("word…"), out);
  });

  it("cuts mid-word when there is no usable space", () => {
    const out = truncateForPreview("x".repeat(300));
    assert.equal(out.length, PREVIEW_DESCRIPTION_MAX);
    assert.ok(out.endsWith("…"));
  });
});
