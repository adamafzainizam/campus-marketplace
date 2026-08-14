import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_DELETIONS_PER_RUN,
  MIN_ORPHAN_AGE_MS,
  isCronAuthorized,
  isOrphan,
  selectOrphans,
} from "./orphan-cleanup-rules.ts";

import { LISTING_IMAGE_PREFIX } from "./upload-constraints.ts";

const NOW = new Date("2026-08-14T12:00:00.000Z");

/** A key shaped exactly like one `/api/upload` would mint. */
const KEY = "listings/clx0000000000000000000000/8bd0b9b0-0f1b-4a3e-9d1a-2c3d4e5f6071.jpg";

function ageOf(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

describe("MIN_ORPHAN_AGE_MS", () => {
  // The grace period is the only thing standing between the cleanup job and a
  // photo that has been uploaded but whose listing hasn't been submitted yet.
  // A presigned URL lives 300s; a person filling in the form takes minutes.
  it("is generous enough to cover an in-progress listing submission", () => {
    assert.ok(MIN_ORPHAN_AGE_MS >= 60 * 60 * 1000);
    assert.equal(MIN_ORPHAN_AGE_MS, 24 * 60 * 60 * 1000);
  });
});

describe("isOrphan", () => {
  it("flags an unreferenced object older than the grace period", () => {
    const object = { key: KEY, lastModified: ageOf(MIN_ORPHAN_AGE_MS + 1000) };
    assert.equal(isOrphan(object, new Set(), NOW), true);
  });

  it("spares an object a listing still references, however old", () => {
    const object = { key: KEY, lastModified: ageOf(365 * 24 * 60 * 60 * 1000) };
    assert.equal(isOrphan(object, new Set([KEY]), NOW), false);
  });

  // The load-bearing guard. Upload happens before `createListing`, so a
  // freshly uploaded object is legitimately unreferenced while the user is
  // still typing. Deleting it would break the golden path, not clean up after
  // it.
  it("spares an unreferenced object still inside the grace period", () => {
    const object = { key: KEY, lastModified: ageOf(60 * 1000) };
    assert.equal(isOrphan(object, new Set(), NOW), false);
  });

  it("spares an object exactly at the grace-period boundary", () => {
    const object = { key: KEY, lastModified: ageOf(MIN_ORPHAN_AGE_MS) };
    assert.equal(isOrphan(object, new Set(), NOW), false);
  });

  // R2 always reports LastModified, but an absent value must never be read as
  // "old enough" — that would delete every object whose age we can't prove.
  it("spares an object whose age cannot be determined", () => {
    assert.equal(isOrphan({ key: KEY }, new Set(), NOW), false);
    assert.equal(
      isOrphan({ key: KEY, lastModified: undefined }, new Set(), NOW),
      false,
    );
  });

  // Defence in depth: the job lists a prefix, but if it were ever pointed at a
  // wider one it must still refuse to touch keys this app didn't mint.
  it("spares any key outside the listings prefix", () => {
    const old = ageOf(MIN_ORPHAN_AGE_MS + 1000);
    assert.equal(isOrphan({ key: "backups/db.sql", lastModified: old }, new Set(), NOW), false);
    assert.equal(isOrphan({ key: "listings", lastModified: old }, new Set(), NOW), false);
    assert.equal(
      isOrphan({ key: "not-listings/a/b.jpg", lastModified: old }, new Set(), NOW),
      false,
    );
  });
});

describe("selectOrphans", () => {
  const old = ageOf(MIN_ORPHAN_AGE_MS + 1000);
  const fresh = ageOf(1000);

  function keyN(n: number): string {
    return `${LISTING_IMAGE_PREFIX}user/${String(n).padStart(8, "0")}.jpg`;
  }

  it("returns only the keys that qualify as orphans", () => {
    const objects = [
      { key: keyN(1), lastModified: old },
      { key: keyN(2), lastModified: fresh },
      { key: keyN(3), lastModified: old },
      { key: "other/thing.jpg", lastModified: old },
    ];

    const selected = selectOrphans(objects, new Set([keyN(3)]), NOW);

    assert.deepEqual(selected, [keyN(1)]);
  });

  it("returns nothing when every object is accounted for", () => {
    const objects = [{ key: keyN(1), lastModified: fresh }];
    assert.deepEqual(selectOrphans(objects, new Set(), NOW), []);
    assert.deepEqual(selectOrphans([], new Set(), NOW), []);
  });

  // A blast radius, not a performance tuning knob. If the reference set were
  // ever read wrongly, this caps one run's damage at something recoverable
  // instead of emptying the bucket.
  it("never deletes more than the per-run cap", () => {
    const objects = Array.from({ length: MAX_DELETIONS_PER_RUN + 50 }, (_, i) => ({
      key: keyN(i),
      lastModified: old,
    }));

    const selected = selectOrphans(objects, new Set(), NOW);

    assert.equal(selected.length, MAX_DELETIONS_PER_RUN);
  });

  it("caps at a value that is bounded and positive", () => {
    assert.ok(MAX_DELETIONS_PER_RUN > 0);
    assert.ok(Number.isInteger(MAX_DELETIONS_PER_RUN));
    assert.ok(MAX_DELETIONS_PER_RUN <= 1000);
  });
});

describe("isCronAuthorized", () => {
  const SECRET = "s3cret-value-from-the-environment";

  it("accepts a bearer token matching the configured secret", () => {
    assert.equal(isCronAuthorized(`Bearer ${SECRET}`, SECRET), true);
  });

  it("rejects a wrong secret of the same length", () => {
    const wrong = "x".repeat(SECRET.length);
    assert.equal(wrong.length, SECRET.length);
    assert.equal(isCronAuthorized(`Bearer ${wrong}`, SECRET), false);
  });

  it("rejects a wrong secret of a different length", () => {
    assert.equal(isCronAuthorized("Bearer short", SECRET), false);
    assert.equal(isCronAuthorized(`Bearer ${SECRET}extra`, SECRET), false);
  });

  it("rejects the secret sent without the Bearer scheme", () => {
    assert.equal(isCronAuthorized(SECRET, SECRET), false);
  });

  it("rejects a missing or non-string header", () => {
    assert.equal(isCronAuthorized(null, SECRET), false);
    assert.equal(isCronAuthorized(undefined, SECRET), false);
    assert.equal(isCronAuthorized(42, SECRET), false);
    assert.equal(isCronAuthorized("", SECRET), false);
  });

  // Fails closed. If CRON_SECRET is missing in the deployment environment the
  // route must deny everyone rather than accept anyone — an unauthenticated
  // deletion endpoint is strictly worse than a cleanup job that never runs.
  it("denies every request when no secret is configured", () => {
    assert.equal(isCronAuthorized("Bearer ", undefined), false);
    assert.equal(isCronAuthorized("Bearer ", ""), false);
    assert.equal(isCronAuthorized("Bearer undefined", undefined), false);
    assert.equal(isCronAuthorized(`Bearer ${SECRET}`, ""), false);
    assert.equal(isCronAuthorized("Bearer anything", null), false);
  });
});
