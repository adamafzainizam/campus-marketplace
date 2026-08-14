import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MAX_CRUMB_LABEL, buildBreadcrumbTrail } from "./breadcrumbs.ts";

describe("buildBreadcrumbTrail", () => {
  it("always starts at Home, linked to the root", () => {
    const trail = buildBreadcrumbTrail([{ label: "Post a listing", href: "/listings/new" }]);
    assert.equal(trail[0].label, "Home");
    assert.equal(trail[0].href, "/");
  });

  // The last crumb is the page you are already on, so linking it invites a
  // pointless navigation and reads as a bug.
  it("leaves the final crumb unlinked", () => {
    const trail = buildBreadcrumbTrail([
      { label: "Listings", href: "/listings" },
      { label: "Mini fridge", href: "/listings/abc" },
    ]);
    assert.equal(trail.at(-1)?.label, "Mini fridge");
    assert.equal(trail.at(-1)?.href, undefined);
    // Everything before it stays navigable.
    assert.equal(trail[1].href, "/listings");
  });

  it("returns Home alone, unlinked, for the home page itself", () => {
    const trail = buildBreadcrumbTrail([]);
    assert.deepEqual(trail, [{ label: "Home" }]);
  });

  // Listing titles are user-supplied and can be long enough to wrap the trail
  // onto several lines or push it off a phone screen.
  it("truncates an over-long label", () => {
    const long = "A".repeat(MAX_CRUMB_LABEL + 20);
    const trail = buildBreadcrumbTrail([{ label: long }]);
    const label = trail.at(-1)!.label;
    assert.ok(label.length <= MAX_CRUMB_LABEL + 1, `label was ${label.length} chars`);
    assert.ok(label.endsWith("…"), "truncated labels should end with an ellipsis");
  });

  it("leaves a label at exactly the limit untouched", () => {
    const exact = "B".repeat(MAX_CRUMB_LABEL);
    assert.equal(buildBreadcrumbTrail([{ label: exact }]).at(-1)?.label, exact);
  });

  it("collapses surrounding whitespace in a label", () => {
    assert.equal(buildBreadcrumbTrail([{ label: "  Mini   fridge  " }]).at(-1)?.label, "Mini fridge");
  });

  it("drops crumbs whose label is empty once trimmed", () => {
    const trail = buildBreadcrumbTrail([{ label: "   " }, { label: "Messages" }]);
    assert.deepEqual(trail.map((c) => c.label), ["Home", "Messages"]);
  });

  it("does not mutate the input", () => {
    const input = [{ label: "Listings", href: "/listings" }];
    buildBreadcrumbTrail(input);
    assert.deepEqual(input, [{ label: "Listings", href: "/listings" }]);
  });
});
