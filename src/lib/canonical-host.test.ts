import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_ORIGIN,
  LEGACY_HOSTS,
  hostPattern,
  legacyHostRedirects,
} from "./canonical-host.ts";

// Mirrors how Next matches a `has` host item
// (next/dist/shared/lib/router/utils/prepare-destination.js).
function nextMatches(value: string, host: string): boolean {
  return new RegExp(`^${value}$`).test(host);
}

describe("legacyHostRedirects", () => {
  const rules = legacyHostRedirects();

  it("redirects every legacy host, permanently, keeping the path", () => {
    assert.equal(rules.length, LEGACY_HOSTS.length);
    for (const rule of rules) {
      assert.equal(rule.permanent, true);
      assert.equal(rule.source, "/:path*");
      assert.equal(rule.destination, `${CANONICAL_ORIGIN}/:path*`);
    }
  });

  it("matches each legacy host exactly", () => {
    LEGACY_HOSTS.forEach((host, i) => {
      assert.ok(nextMatches(rules[i].has[0].value, host));
    });
  });

  // An unescaped dot would match any character, and a missing anchor would
  // match a longer host. Neither must redirect.
  it("does not match look-alike or longer hosts", () => {
    const value = rules[0].has[0].value;
    for (const host of [
      "campus-marketplace-adamafzainizamXvercel.app",
      "xcampus-marketplace-adamafzainizam.vercel.app",
      "campus-marketplace-adamafzainizam.vercel.app.evil.example",
    ]) {
      assert.equal(nextMatches(value, host), false, host);
    }
  });

  // A redirect from the canonical host to itself would loop forever.
  it("never redirects the canonical host", () => {
    const canonical = new URL(CANONICAL_ORIGIN).host;
    for (const rule of rules) {
      assert.equal(nextMatches(rule.has[0].value, canonical), false);
    }
  });

  it("does not catch preview deployments", () => {
    for (const rule of rules) {
      assert.equal(
        nextMatches(rule.has[0].value, "campus-marketplace-git-feature-x-adamafzainizam.vercel.app"),
        false,
      );
    }
  });
});

describe("hostPattern", () => {
  it("escapes regex metacharacters", () => {
    assert.equal(hostPattern("a.b"), "a\\.b");
  });
});
