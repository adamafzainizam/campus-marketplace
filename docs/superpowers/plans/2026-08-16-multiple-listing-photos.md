# Multiple Listing Photos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Let a listing carry up to three photos instead of one, without the orphan-cleanup cron deleting the extras a day later.

**Architecture:** `Listing.imageUrl String?` becomes `imageKeys String[]`, where array order is display order and `imageKeys[0]` is the cover. Rules live in the existing `upload-constraints.ts`. The cron's reference set changes in the same PR, because it is the one part of this that loses data silently if it is wrong.

**Tech Stack:** Next.js 16, Prisma 7.9.1, Postgres arrays, `node:test`. **Zero new dependencies.**

**Spec:** `docs/superpowers/specs/2026-08-16-multiple-listing-photos-design.md`

## Global Constraints

- **Zero new dependencies.** No carousel library, no drag library.
- **`MAX_LISTING_PHOTOS` and the upload rate limit move together.** 10 listings/hour × 3 photos = 30 uploads/hour. Changing one without the other silently rebuilds a wall sellers hit.
- **The cron ships in the same PR as the schema.** Not after.
- **Photos are user input even after upload** (Gotcha #17): the browser uploads to R2 directly, so every key the client hands back is re-validated against the session user.
- **`npm test` (357) and `npm run test:db` (29) stay green**, plus `tsc --noEmit`, `eslint`, `next build`.
- **Reviewed at 375px and 1280px, light and dark.**

---

### Task 1: The rules

**Files:** `src/lib/upload-constraints.ts`, `src/lib/upload-constraints.test.ts`

**Produces:** `MAX_LISTING_PHOTOS = 3`; `validateImageKeys(value: unknown, userId: string): ImageKeysResult`, where `type ImageKeysResult = { ok: true; value: string[] } | { ok: false; error: string }`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/upload-constraints.test.ts` (match the file's existing `describe`/`test` convention — check which it uses before writing):

```ts
describe("validateImageKeys", () => {
  const userId = "user123";
  const key = (n: number) => `listings/${userId}/0000000${n}-0000-4000-8000-000000000000.jpg`;

  test("accepts an empty array — a listing may have no photos", () => {
    assert.deepEqual(validateImageKeys([], userId), { ok: true, value: [] });
  });

  test("accepts up to the cap, preserving order", () => {
    const keys = [key(1), key(2), key(3)];
    assert.deepEqual(validateImageKeys(keys, userId), { ok: true, value: keys });
  });

  test("rejects more than the cap", () => {
    const keys = [key(1), key(2), key(3), key(4)];
    const result = validateImageKeys(keys, userId);

    assert.equal(result.ok, false);
    assert.match(result.ok === false ? result.error : "", /3/);
  });

  test("rejects anything that is not an array", () => {
    for (const value of [null, undefined, "a", {}, 5]) {
      assert.equal(validateImageKeys(value, userId).ok, false);
    }
  });

  test("rejects a key belonging to another user", () => {
    // Gotcha #17: the browser uploads straight to R2 and then reports the key,
    // so the server never observes the upload and must re-check ownership.
    const theirs = `listings/someone-else/00000001-0000-4000-8000-000000000000.jpg`;

    assert.equal(validateImageKeys([key(1), theirs], userId).ok, false);
  });

  test("de-duplicates rather than storing the same photo twice", () => {
    const result = validateImageKeys([key(1), key(1), key(2)], userId);

    assert.deepEqual(result.ok === true ? result.value : null, [key(1), key(2)]);
  });

  test("counts duplicates after de-duplication, not before", () => {
    // Four entries, three distinct — this is legal.
    const result = validateImageKeys([key(1), key(1), key(2), key(3)], userId);

    assert.equal(result.ok, true);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

`npm test` → FAIL, `validateImageKeys is not exported`.

- [ ] **Step 3: Implement**

Append to `src/lib/upload-constraints.ts`:

```ts
/**
 * How many photos one listing may carry.
 *
 * Tied to the upload rate limit, not chosen independently: the listing limit
 * is 10/hour, so three photos each implies exactly 30 uploads/hour, which is
 * what `RATE_LIMITS.upload` is set to. **Raising this without raising that
 * silently rebuilds a wall sellers hit** — see the design spec.
 */
export const MAX_LISTING_PHOTOS = 3;

export type ImageKeysResult =
  | { ok: true; value: string[] }
  | { ok: false; error: string };

/**
 * Validates the list of object keys the browser reports after uploading.
 *
 * `unknown` because this arrives from a server action, which is a public POST
 * endpoint (audit finding S3). Every key is re-checked against the session
 * user: the browser uploads directly to R2, so the server never sees the
 * upload and must not trust the key that comes back (Gotcha #17).
 *
 * Duplicates are dropped rather than rejected — the same photo listed twice is
 * a client slip, not an attack, and the cap applies to what would be stored.
 */
export function validateImageKeys(
  value: unknown,
  userId: string,
): ImageKeysResult {
  if (!Array.isArray(value)) {
    return { ok: false, error: "Photos must be a list." };
  }

  const unique: string[] = [];
  for (const key of value) {
    if (!isValidListingImageKey(key, userId)) {
      return { ok: false, error: "One of those photos isn't yours to attach." };
    }
    if (!unique.includes(key)) unique.push(key);
  }

  if (unique.length > MAX_LISTING_PHOTOS) {
    return {
      ok: false,
      error: `A listing can have at most ${MAX_LISTING_PHOTOS} photos.`,
    };
  }

  return { ok: true, value: unique };
}
```

- [ ] **Step 4: Pass, then mutation-test the ownership check**

`npm test` → 357 + 7 = **364 passing**.

Then temporarily change `if (!isValidListingImageKey(key, userId))` to `if (typeof key !== "string")`, run `npm test`, and confirm "rejects a key belonging to another user" fails. Revert. **The file is tracked, so `git checkout src/lib/upload-constraints.ts` restores it.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/upload-constraints.ts src/lib/upload-constraints.test.ts
git commit -m "Add the rules for multiple listing photos

MAX_LISTING_PHOTOS is 3, tied to the upload rate limit rather than
chosen independently: 10 listings/hour times three photos is exactly the
30 uploads/hour the limit allows.

validateImageKeys re-checks every key against the session user, because
the browser uploads straight to R2 and the server never observes the
upload (Gotcha #17). Duplicates are dropped rather than rejected — the
same photo twice is a client slip, not an attack.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Schema and migration

**Files:** `prisma/schema.prisma`, a new hand-written migration

- [ ] **Step 1: Change the model**

In `prisma/schema.prisma`, replace `imageUrl String?` on `Listing` with:

```prisma
  /// R2 object keys, in display order. `imageKeys[0]` is the cover shown on
  /// the browse grid, in the inbox and on /listings/mine.
  ///
  /// An array rather than a join table because there is no per-photo data to
  /// hold, and rather than a cover column plus a rest column because two
  /// sources of truth for "the photos" is how the cleanup job ends up
  /// deleting live images.
  imageKeys String[]
```

- [ ] **Step 2: Create the migration by hand**

```bash
mkdir -p prisma/migrations/20260816000000_listing_image_keys
```

Write `prisma/migrations/20260816000000_listing_image_keys/migration.sql`:

```sql
-- Multiple photos per listing.
--
-- Hand-written rather than generated: a generated migration is free to drop
-- and recreate the column, which here would discard every existing photo
-- reference. The backfill must run between the add and the drop.

ALTER TABLE "listings" ADD COLUMN "imageKeys" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "listings"
SET "imageKeys" = ARRAY["imageUrl"]
WHERE "imageUrl" IS NOT NULL;

ALTER TABLE "listings" DROP COLUMN "imageUrl";
```

- [ ] **Step 3: Apply it to the development database and check the backfill**

```bash
npx prisma migrate dev --skip-generate
npx prisma generate
```

Then confirm nothing was lost:
```bash
npx tsx -e '
import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
(async () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const all = await db.listing.findMany({ select: { id: true, imageKeys: true } });
  console.log("listings:", all.length);
  console.log("with photos:", all.filter((l) => l.imageKeys.length > 0).length);
  await db.$disconnect();
})();'
```
Expected: the "with photos" count matches how many listings had a non-null `imageUrl` before. **If it is 0 and it should not be, stop** — the backfill ran after the drop, or in the wrong order.

- [ ] **Step 4: Verify the generated client knows the field**

```bash
grep -n "imageKeys" src/generated/prisma/models/Listing.ts | head -3
```
Expected: a match. Gotcha #2 — a migration can apply without the client picking it up.

`npx tsc --noEmit` will now fail across every file reading `imageUrl`. That is expected and Tasks 3–5 fix it; do not commit yet.

---

### Task 3: The cron — the part that loses data if it is wrong

**Files:** `src/app/api/cron/cleanup-orphans/route.ts`, `src/lib/conversations.db-test.ts` *(or a new `cleanup-orphans.db-test.ts`)*

- [ ] **Step 1: Change the reference set**

Replace:
```ts
  const listings = await db.listing.findMany({
    where: { imageUrl: { not: null } },
    select: { imageUrl: true },
  });
  const referencedKeys = new Set(
    listings.map((listing) => listing.imageUrl).filter((key): key is string => key !== null),
  );
```
with:
```ts
  const listings = await db.listing.findMany({
    where: { imageKeys: { isEmpty: false } },
    select: { imageKeys: true },
  });
  // Every key of every listing, not just the cover. Taking only the first
  // would delete photos two and three a day after they were uploaded, leaving
  // the listing showing a broken image with nothing to point at the cause.
  const referencedKeys = new Set(listings.flatMap((listing) => listing.imageKeys));
```

- [ ] **Step 2: Write the database-backed test**

Create `src/app/api/cron/cleanup-orphans/reference-set.db-test.ts`:

```ts
import { after, before, test } from "node:test";
import assert from "node:assert/strict";

import { db } from "@/lib/db";
import {
  createConversationWorld,
  type ConversationWorld,
} from "@/lib/db-test-support";

let world: ConversationWorld;

before(async () => {
  world = await createConversationWorld();
});

after(async () => {
  await world?.cleanup();
});

test("the reference set protects every photo, not just the cover", async () => {
  const keys = [
    `listings/${world.sellerId}/aaaaaaaa-0000-4000-8000-000000000000.jpg`,
    `listings/${world.sellerId}/bbbbbbbb-0000-4000-8000-000000000000.jpg`,
    `listings/${world.sellerId}/cccccccc-0000-4000-8000-000000000000.jpg`,
  ];
  await db.listing.update({
    where: { id: world.listingId },
    data: { imageKeys: keys },
  });

  // Exactly the query the cron runs to build its reference set.
  const listings = await db.listing.findMany({
    where: { imageKeys: { isEmpty: false } },
    select: { imageKeys: true },
  });
  const referenced = new Set(listings.flatMap((listing) => listing.imageKeys));

  for (const key of keys) {
    assert.ok(referenced.has(key), `${key} was not protected from deletion`);
  }
});
```

Note this test deliberately re-states the query rather than importing the route: the route is a Next handler needing a Request and the cron secret, and what is being pinned here is the *shape* of the reference set. If it drifts from the route, the mutation test in Step 4 is what catches it.

- [ ] **Step 3: Run it**

`npm run test:db` → **30 passing**.

- [ ] **Step 4: Mutation-test it**

In the **test file**, change `listings.flatMap((listing) => listing.imageKeys)` to `listings.map((listing) => listing.imageKeys[0])` — the exact bug this guards against — run `npm run test:db`, and confirm it fails naming the second key. Revert.

Then do the same in the **route**, and confirm by reading that the route and the test now disagree; revert. If the route's mutation does not fail anything, say so plainly in the PR — it means the test is pinning a copy and not the route, which is a known limit of this test's shape.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/cron/cleanup-orphans/route.ts" "src/app/api/cron/cleanup-orphans/reference-set.db-test.ts"
git commit -m "Protect every listing photo from the cleanup job, not just the cover

The cron deletes any R2 object no listing references, and it built that
set from a single imageUrl column. With photos in an array, taking only
the first would delete photos two and three twenty-four hours after
upload — silently, leaving a broken image and no way to guess the cause
from the symptom.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Server actions and every read of the old column

**Files:** `src/app/listings/new/actions.ts`, `src/app/page.tsx`, `src/app/listings/[id]/page.tsx`, `src/app/listings/mine/page.tsx`, `src/app/listings/[id]/edit/page.tsx`, `src/lib/conversations.ts`

- [ ] **Step 1: Find every site**

```bash
grep -rn "imageUrl" src/ --include=*.ts --include=*.tsx | grep -v generated | grep -v "\.test\."
```

- [ ] **Step 2: `createListing`**

Replace the single-key handling (around lines 60–61 and 97) with:

```ts
  const keys = validateImageKeys(
    (input as Record<string, unknown>).imageKeys ?? [],
    userId,
  );
  if (!keys.ok) return failure(keys.error);
```
and write `imageKeys: keys.value` where `imageUrl` was written. Use whatever failure helper the file already uses — **expected failures are returned, never thrown** (Gotcha #35).

- [ ] **Step 3: `updateListing`**

The existing code distinguishes "field absent" (leave alone) from "explicit null" (clear). Preserve that: if `imageKeys` is absent from the payload, do not touch the column; if present, validate and set it.

- [ ] **Step 4: The four read sites**

Each selects `imageUrl: true` and renders `getImageUrl(listing.imageUrl)`. Change the select to `imageKeys: true` and read `listing.imageKeys[0]`, guarding on `imageKeys.length > 0` where the old code guarded on non-null. `src/lib/conversations.ts` maps it into `listingImageKey`, which keeps its name and becomes `listing.imageKeys[0] ?? null`.

- [ ] **Step 5: Verify**

`npx tsc --noEmit && npx eslint && npm test && npm run test:db`
Expected: clean, 364 and 30. `tsc` passing again is the signal every site was found.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Read the cover photo from the array everywhere

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The picker and the gallery

**Files:** `src/components/PhotoPicker.tsx`, `src/app/listings/new/ListingForm.tsx`, `src/app/listings/[id]/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Make the picker hold a list**

`PhotoPicker` currently manages one file. It takes a `value: string[]` and `onChange(keys: string[])`, renders a thumbnail per key, and for each a remove control plus — on every one except the first — a "Make cover" button that moves that key to index 0. The first thumbnail is labelled "Cover".

The file input accepts `multiple`, and the drop zone is hidden (not merely disabled) once `value.length === MAX_LISTING_PHOTOS`, with the count shown as "2 of 3". Per-file type and size checks stay exactly as they are and run on each selected file; a file that fails is reported and the others still upload.

- [ ] **Step 2: The gallery**

On `src/app/listings/[id]/page.tsx`, the cover renders large as it does now. Below it, when `imageKeys.length > 1`, a row of `<button>` thumbnails — buttons, not divs, so the strip is keyboard-navigable — that set which key is shown. This needs a small client component; keep it to state plus `getImageUrl`, with **no carousel library and no swipe handling**.

- [ ] **Step 3: Verify and look**

`npx tsc --noEmit && npx eslint && npm test && npx next build`

Then `npm run dev` and post a listing with three photos: check the count, removing one, making the second the cover, and that the browse grid then shows the new cover.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Let sellers add up to three photos and choose the cover

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Rate limit, docs, PR

**Files:** `src/lib/rate-limit-rules.ts`, `AGENTS.md`

- [ ] **Step 1: Raise the upload limit**

In `src/lib/rate-limit-rules.ts`, change `upload: { limit: 20, windowMs: HOUR }` to `limit: 30`, and extend the comment above `RATE_LIMITS` to record the tie:

```
   * The upload limit is derived, not chosen: the listing limit is 10/hour and
   * MAX_LISTING_PHOTOS is 3, so 30 is exactly what posting at full rate
   * requires. The two must move together — raising the photo cap alone
   * rebuilds a wall sellers hit, and this comment is the only thing that says so.
```

Check `rate-limit-rules.test.ts` for an assertion on the old value and update it.

- [ ] **Step 2: Full verification**

```bash
npm test && npm run test:db && npx tsc --noEmit && npx eslint && npx next build
```

- [ ] **Step 3: Production migration note**

`scripts/migrate-on-deploy.mjs` applies migrations on production deploys, so this ships automatically. **Confirm the backfill is in the migration itself** — production's existing listings depend on it, and there is no second chance once `imageUrl` is dropped.

- [ ] **Step 4: Decision Log and gotcha**

```markdown
- **2026-08-16** — **Up to three photos per listing, and the number is derived rather than chosen.** The request was five; three was taken because the arithmetic then lines up exactly — the listing limit is 10/hour, so three photos each implies precisely the 30 uploads/hour the upload limit now allows. The old limit of 20 was set when one listing meant one upload, and raising the photo count without revisiting it would have silently changed what that limit meant. `imageUrl String?` became `imageKeys String[]`, with array order as display order so the cover cannot disagree with the photos; a join table was rejected as a join on every listing read to store three short strings, and a cover-plus-rest pair was rejected harder as two sources of truth. **The load-bearing change was the orphan-cleanup cron**, which built its reference set from the single column: left alone it would have deleted photos two and three a day after upload, silently, leaving a broken image with nothing pointing at the cause.
```

```markdown
48. **A schema change can turn a correct cleanup job into a data-loss bug without touching it.** `/api/cron/cleanup-orphans` deletes every R2 object no listing references, and it was right for as long as a listing had one photo. Moving to an array made "the set of referenced keys" a different query, and a job still reading the old shape would have deleted every photo after the first — twenty-four hours later, so not during testing, and presenting as a broken image rather than as a failed job. **When changing how something is stored, grep for what *reads* it before deciding the change is small**, and pay attention to anything that deletes. The cron is the only thing in this codebase that destroys data on a schedule.
```

- [ ] **Step 5: Commit, push, PR**

```bash
git add -A
git commit -m "Raise the upload limit to match three photos per listing

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin feature/listing-photos
```

---

## Self-Review

**Spec coverage:** Three photos and the rate-limit tie → Tasks 1 and 6. `imageKeys String[]` and the hand-written migration → Task 2. The cron → Task 3, mutation-tested. Rules → Task 1. Picker, cover, gallery → Task 5. Every other read site → Task 4. Edit page → Tasks 4 and 5. Accessibility (thumbnails as buttons) → Task 5 Step 2. No-photo listings staying legal → Task 1's first test.

**Placeholder scan:** No TBD/TODO. Task 4 Steps 2–4 describe edits against code the implementer must read first, and each names the exact rule to apply and the exact symptom that proves completeness (`tsc` passing again). Task 5 is described rather than transcribed because `PhotoPicker` is being restructured; its behaviour is specified precisely enough to check.

**Type consistency:** `validateImageKeys` and `ImageKeysResult` are defined in Task 1 and used in Task 4. `MAX_LISTING_PHOTOS` is used in Tasks 1, 5 and 6. `imageKeys` is the field name throughout; `listingImageKey` keeps its existing name in the conversations DTO deliberately, and Task 4 Step 4 says so. Counts run 357 → 364 and 29 → 30 consistently.
