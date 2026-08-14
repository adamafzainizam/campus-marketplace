/**
 * Policy for the orphaned-image cleanup job — no I/O, so it can be tested
 * without R2 or a database.
 *
 * Closes the remaining half of security audit finding S2. Uploads happen
 * before `createListing` runs, so abandoning the form leaves an R2 object that
 * nothing references and that stays publicly readable at its `r2.dev` URL.
 * Rate limiting bounds how many can accumulate; this decides which ones are
 * safe to delete.
 *
 * Both rules here are deliberately conservative: every ambiguous case resolves
 * to "keep". Failing to delete an orphan costs a few kilobytes of a 10GB free
 * tier; deleting a live image destroys a user's listing photo.
 */

import { createHash, timingSafeEqual } from "node:crypto";

import { LISTING_IMAGE_PREFIX } from "./upload-constraints.ts";

/**
 * How long an unreferenced object is left alone before it counts as abandoned.
 *
 * This is the guard that keeps the job from racing the golden path: the
 * browser uploads to R2 first and only then calls `createListing`, so an
 * object is legitimately unreferenced for as long as someone is still filling
 * in the form. Twenty-four hours is far beyond any plausible session and still
 * well inside a daily cleanup cadence.
 */
export const MIN_ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Blast radius for a single run, not a performance knob.
 *
 * The job's whole safety rests on the reference set being read correctly. If
 * that ever went wrong — a partial query, a schema change — this bounds one
 * run's damage to something a person can notice and stop, rather than letting
 * one bad run empty the bucket. A backlog larger than this simply drains over
 * successive days.
 */
export const MAX_DELETIONS_PER_RUN = 500;

export type StoredObject = {
  key: string;
  lastModified?: Date;
};

/**
 * Decides whether a stored object can be deleted.
 *
 * `referencedKeys` is the set of every `Listing.imageUrl` currently in the
 * database — the caller must read it *before* listing the bucket, so that a
 * listing created during the run is treated as referenced rather than missed.
 */
export function isOrphan(
  object: StoredObject,
  referencedKeys: ReadonlySet<string>,
  now: Date,
): boolean {
  // Never touch anything outside the prefix this app writes to, regardless of
  // what the caller listed.
  if (!object.key.startsWith(LISTING_IMAGE_PREFIX)) return false;

  if (referencedKeys.has(object.key)) return false;

  // An object whose age can't be established is kept: absent must never be
  // read as "old enough".
  if (!(object.lastModified instanceof Date)) return false;

  const age = now.getTime() - object.lastModified.getTime();
  return age > MIN_ORPHAN_AGE_MS;
}

/**
 * Picks the keys a single run may delete, newest-safe and capped.
 *
 * Kept separate from `isOrphan` so the per-run cap is enforced in one place
 * that the route cannot accidentally bypass.
 */
export function selectOrphans(
  objects: readonly StoredObject[],
  referencedKeys: ReadonlySet<string>,
  now: Date,
): string[] {
  const selected: string[] = [];
  for (const object of objects) {
    if (selected.length >= MAX_DELETIONS_PER_RUN) break;
    if (isOrphan(object, referencedKeys, now)) selected.push(object.key);
  }
  return selected;
}

/**
 * Authorizes a request to the cleanup route against `CRON_SECRET`.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. The route deletes
 * data, so this fails closed: with no secret configured, nobody is authorized.
 * The alternative — treating a missing secret as "no auth required" — would
 * turn a misconfigured deploy into a public deletion endpoint.
 */
export function isCronAuthorized(
  authorizationHeader: unknown,
  secret: unknown,
): boolean {
  if (typeof secret !== "string" || secret.length === 0) return false;
  if (typeof authorizationHeader !== "string") return false;

  const scheme = "Bearer ";
  if (!authorizationHeader.startsWith(scheme)) return false;

  const presented = authorizationHeader.slice(scheme.length);

  // Compared through a fixed-width digest so `timingSafeEqual` always gets
  // equal-length buffers (it throws otherwise) and the comparison leaks
  // neither the secret's contents nor its length.
  return timingSafeEqual(sha256(presented), sha256(secret));
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}
