import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  RATE_LIMITS,
  isWithinLimit,
  rateLimitKey,
  rateLimitRuleFor,
  retryAfterSeconds,
  windowEndFrom,
} from "./rate-limit-rules.ts";

describe("RATE_LIMITS policy", () => {
  it("defines a positive limit and window for every action", () => {
    for (const [action, rule] of Object.entries(RATE_LIMITS)) {
      assert.ok(rule.limit > 0, `${action} limit must be positive`);
      assert.ok(rule.windowMs > 0, `${action} window must be positive`);
      assert.ok(Number.isInteger(rule.limit), `${action} limit must be an integer`);
    }
  });

  // The upload limit is what stands between an authenticated account and R2's
  // 10GB free tier, given Cloudflare has no hard spending cap. At a 5MB max
  // file size this bounds one account to ~100MB/hour.
  it("keeps the upload budget well inside the R2 free tier", () => {
    const maxBytesPerHour = RATE_LIMITS.upload.limit * 5 * 1024 * 1024;
    assert.ok(
      maxBytesPerHour <= 200 * 1024 * 1024,
      `upload budget of ${maxBytesPerHour} bytes/hour is too generous`,
    );
    assert.equal(RATE_LIMITS.upload.windowMs, 3_600_000);
  });
});

describe("rateLimitRuleFor", () => {
  it("returns the configured rule", () => {
    assert.equal(rateLimitRuleFor("message").limit, RATE_LIMITS.message.limit);
  });

  // Same prototype-chain hazard as Known Gotchas #15. Here a bare lookup
  // wouldn't just be wrong, it would fail *open*: an undefined rule means no
  // effective limit.
  it("throws on keys inherited from Object.prototype rather than failing open", () => {
    for (const inherited of ["constructor", "toString", "valueOf", "__proto__"]) {
      assert.throws(
        () => rateLimitRuleFor(inherited as never),
        /Unknown rate limit action/,
        `expected "${inherited}" to be rejected`,
      );
    }
  });
});

describe("rateLimitKey", () => {
  it("namespaces by action so budgets can't be shared", () => {
    assert.equal(rateLimitKey("upload", "user1"), "upload:user1");
    assert.notEqual(
      rateLimitKey("upload", "user1"),
      rateLimitKey("listing", "user1"),
    );
  });

  it("keeps different users on different keys", () => {
    assert.notEqual(rateLimitKey("upload", "user1"), rateLimitKey("upload", "user2"));
  });
});

describe("windowEndFrom", () => {
  it("advances by exactly the window length", () => {
    const now = new Date("2026-08-13T00:00:00.000Z");
    assert.equal(
      windowEndFrom(now, 60_000).toISOString(),
      "2026-08-13T00:01:00.000Z",
    );
  });

  it("does not mutate the date it is given", () => {
    const now = new Date("2026-08-13T00:00:00.000Z");
    windowEndFrom(now, 60_000);
    assert.equal(now.toISOString(), "2026-08-13T00:00:00.000Z");
  });
});

describe("isWithinLimit", () => {
  const rule = { limit: 20, windowMs: 3_600_000 };

  it("is inclusive of the limit and excludes the one past it", () => {
    assert.equal(isWithinLimit(1, rule), true);
    assert.equal(isWithinLimit(20, rule), true);
    assert.equal(isWithinLimit(21, rule), false);
    assert.equal(isWithinLimit(1000, rule), false);
  });
});

describe("retryAfterSeconds", () => {
  const now = new Date("2026-08-13T00:00:00.000Z");

  it("rounds up to the next whole second", () => {
    assert.equal(retryAfterSeconds(new Date("2026-08-13T00:00:30.500Z"), now), 31);
  });

  // A Retry-After of 0 invites an immediate retry storm from every blocked
  // client at once.
  it("never returns less than one second", () => {
    assert.equal(retryAfterSeconds(now, now), 1);
    assert.equal(retryAfterSeconds(new Date("2026-08-12T23:00:00.000Z"), now), 1);
  });
});
