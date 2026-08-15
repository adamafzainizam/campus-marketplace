# Multiple photos per listing

**Date:** 2026-08-16
**Status:** Approved, not yet implemented

## The problem

A listing can carry exactly one photo. `Listing.imageUrl` is a single nullable
string holding one R2 object key. For a secondhand marketplace that is too few:
the front, the back, and the scratch you should be honest about are three
different photographs.

## Decisions

### Three photos, not five

The opening request was five. Three was chosen instead, and the reason is that
the numbers then line up exactly rather than approximately:

- the **listing** rate limit is 10 per hour
- at three photos each, that implies at most **30 uploads per hour**
- so the **upload** limit becomes exactly 30, up from 20

Before this change the upload limit was set when one listing meant one upload.
Raising the photo count without revisiting it would have silently changed what
that limit means — a seller posting four listings with full photo sets would
have hit a wall built for a different feature. The two limits are now
consistent by construction instead of independently guessed.

Three also covers what a secondhand listing actually needs, and is lighter on
the phones this site is mostly read on. `MAX_LISTING_PHOTOS` is a single
constant: raising it later is one line plus a rate-limit review, and this
document is the record of why those two numbers must move together.

### Storage: an ordered array on `Listing`

`imageUrl String?` becomes `imageKeys String[]`.

**Array order is display order**, so `imageKeys[0]` is the cover and "Make
cover" is a reorder. One field means cover and photos cannot disagree.

Rejected: a `ListingImage` table — a join on every listing read (browse grid,
detail, inbox, `/listings/mine`) to store three short strings, with no
per-photo metadata to justify it. Rejected harder: keeping `imageUrl` and
adding a second field, which creates two sources of truth for "the photos" and
would require the cleanup job to read both — exactly the bug that makes photos
silently vanish.

### The migration is hand-written

Three statements in one transaction: add `imageKeys`, backfill it
(`ARRAY[imageUrl]` where non-null, `'{}'` otherwise), drop `imageUrl`. Written
by hand for the same reason the `ListingStatus` rename was (Decision Log
2026-08-15): a generated migration is free to drop and recreate, which here
would discard every existing photo reference.

## The safety-critical part

`/api/cron/cleanup-orphans` deletes every R2 object that no listing
references, and it builds that reference set from `Listing.imageUrl`. **The
moment a second photo exists and the cron still reads one column, photos two
and three are deleted 24 hours later** — silently, leaving the listing showing
a broken image, with the cause near-impossible to guess from the symptom.

The cron's reference set therefore becomes a select of `imageKeys` flattened
into the set, and it ships in the same change or not at all. It gets:

- a database-backed test asserting a listing with three photos protects **all
  three** keys
- a mutation test: flatten only the first element of each array and confirm
  that test goes red

This is Gotcha #28's lesson — the job's whole safety rests on the reference set
being read correctly — applied to a schema change rather than to ordering.

## Rules

In `src/lib/upload-constraints.ts`, which already exists for exactly this:

- `MAX_LISTING_PHOTOS = 3`
- `validateImageKeys(value: unknown, userId: string): Result<string[]>` —
  rejects non-arrays, enforces the cap, validates each key with the existing
  `isValidListingImageKey` so a caller cannot attach someone else's photo, and
  de-duplicates.

Pure, tested alongside the existing key tests. The type is `unknown` because
the value arrives from a server action, which is a public POST endpoint
(audit finding S3).

## Interface

**The picker** shows up to three thumbnails. Each has a remove control; each
except the first has "Make cover", which moves it to the front. The first is
labelled as the cover, so the rule is visible rather than folklore. Adding is
disabled at the cap with the count shown ("2 of 3") rather than a silent
rejection. Existing client-side type and size checks apply per file.

**The detail page** shows the cover large with a thumbnail strip beneath;
clicking a thumbnail swaps the main image. A few lines of client state and CSS
— **no carousel library and no swipe gestures**, consistent with the
2026-08-15 decision not to adopt drag machinery for an app that has no drag
interactions.

**Everywhere else takes `imageKeys[0]`** — browse grid, `/listings/mine`, the
inbox thumbnail. One-line changes.

**The edit page** gets the same picker seeded with existing photos, so removing
and adding behave identically before and after posting.

## Accessibility and honesty

- A listing with no photos stays legal. The "No photo" state is unchanged.
- Thumbnails are buttons, not divs, so the strip is keyboard-navigable and the
  active one is announced.
- `alt` stays empty on decorative gallery images, as it is today; the listing
  title carries the meaning.

## Out of scope

- Reordering beyond "make cover". Full ordering needs drag, which this app
  deliberately has none of.
- Per-photo captions or alt text. No data model for it, and no request.
- Image resizing or compression on upload. The 5MB cap and the signed
  `ContentLength` already bound cost; adding a processing step is a separate
  decision.

## Verification

- `npm test` and `npm run test:db` green, plus `tsc --noEmit`, `eslint`,
  `next build`
- The cron's multi-photo protection mutation-tested
- Reviewed at 375px and 1280px, light and dark
- A real posting run in a browser: three photos up, cover changed, one
  removed, listing posted, all three served from R2
