import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { browseHref, parseListingTypeFilter } from "./browse-filters.ts";

describe("browseHref", () => {
  it("returns the bare browse path when nothing is filtered", () => {
    assert.equal(browseHref({}, {}), "/");
  });

  // The bug this exists to prevent: clicking a category chip while a search is
  // active must not throw the search away.
  it("keeps the other active filters when one changes", () => {
    const href = browseHref({ q: "fridge", type: "RENT" }, { category: "furniture" });
    assert.ok(href.includes("q=fridge"), href);
    assert.ok(href.includes("type=RENT"), href);
    assert.ok(href.includes("category=furniture"), href);
  });

  it("removes a filter when it is set to undefined", () => {
    const href = browseHref({ category: "books", q: "maths" }, { category: undefined });
    assert.ok(!href.includes("category"), href);
    assert.ok(href.includes("q=maths"), href);
  });

  it("replaces rather than duplicates an existing filter", () => {
    const href = browseHref({ category: "books" }, { category: "furniture" });
    assert.equal(href.match(/category=/g)?.length, 1, href);
    assert.ok(href.includes("category=furniture"));
  });

  it("percent-encodes values that would otherwise break the query string", () => {
    const href = browseHref({}, { q: "mini fridge & desk" });
    assert.ok(!href.includes(" "), href);
    assert.ok(href.includes("%26") || href.includes("mini+fridge"), href);
  });

  it("drops empty-string values rather than emitting a useless param", () => {
    assert.equal(browseHref({}, { q: "" }), "/");
    assert.equal(browseHref({ q: "x" }, { q: "   " }), "/");
  });
});

describe("parseListingTypeFilter", () => {
  it("accepts the two real types", () => {
    assert.equal(parseListingTypeFilter("SALE"), "SALE");
    assert.equal(parseListingTypeFilter("RENT"), "RENT");
  });

  // Anything unrecognised means "no filter" rather than an error page — this
  // value comes off the URL, where anyone can type anything.
  it("treats an unknown value as no filter", () => {
    for (const value of ["LEASE", "sale", "", undefined, null, 42, {}]) {
      assert.equal(parseListingTypeFilter(value), null, `${String(value)} should not filter`);
    }
  });

  // Known Gotchas #15.
  it("rejects inherited keys from the prototype chain", () => {
    for (const key of ["constructor", "toString", "valueOf"]) {
      assert.equal(parseListingTypeFilter(key), null, `${key} must not filter`);
    }
  });
});
