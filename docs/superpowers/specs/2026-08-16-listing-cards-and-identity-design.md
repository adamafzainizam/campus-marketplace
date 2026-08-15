# Listing cards, the grid, and a mark

**Date:** 2026-08-16
**Status:** Approved, not yet implemented
**Follows:** `docs/superpowers/specs/2026-08-16-design-revamp-design.md` (phases 1–5, merged)

## Why this exists

The five-phase revamp shipped and the builder's reaction was: *"looks like the original but with different fonts and colors."* That is accurate, and the cause was a scoping failure rather than a taste one.

The revamp changed **tokens, type, copy and consistency**. It never changed a single **component**. The listing card — the most repeated element on the site — was not in any phase's scope: Phase 2 was nominally "the home page" but touched only the headline band, the chips and the price colour.

Two of the three original complaints were therefore left standing:

- **"Characterless"** — half-addressed. Type and colour moved; the structure and components did not, and that is where "looks like every other AI-built app" mostly lives.
- **"Empty and lifeless"** — **not addressed at all.** It was diagnosed as chrome-versus-content and treated by reclaiming ~90px of category chips. The real problem is two listings in a four-column grid: half a row of content, then a viewport of nothing. The wrong thing was measured.

The third complaint, "looks unfinished or amateur", *was* genuinely fixed — heading scale, spacing vocabulary, a dead CSS class, a badge that was still blue.

Three directions were chosen from rendered mockups showing the site's **real two listings**, including the one with no photo, rather than from description. That change of method is itself a decision: two rounds of text-described design under-delivered against what the builder pictured.

## Decisions

### The card: dense information

Six facts instead of three.

| | Now | Becomes |
|---|---|---|
| Image | 1:1, bare, no container | 4:3, inside a raised card |
| Title | 15px / 500 | 14px / 600 |
| Price | `.text-price` | 17px / 700, unit de-emphasised |
| Meta | — | category · condition · recency |
| Surface | none — floats on the page | `--surface-raised` with a border |
| No photo | large void, 10px grey text | icon plus "No photo yet" |

Rejected: an **editorial** card with text over a scrim on portrait images — the most distinctive of the three, and the most dependent on photographs. This site's photos are student phone snaps, and its emptiest state is a listing with none at all, which that design turns into a large empty poster instead of a small empty square.

Rejected: a **pinned** card carrying an accent tab and a heavy shadow. Good, and the identity it provided is better served by the mark below, which costs nothing per card and works at favicon size.

**Why more facts.** A card with three facts in a grid of two reads as a demo. Category, condition and recency are what make a marketplace look *used*, and every one of them is already in the database.

### The grid: adapt when listings are scarce

One boolean, two consequences:

```
sparse = listings.length < 8 && no filter is active
```

- **When sparse:** the grid caps at **3 columns** (`grid-cols-2 sm:grid-cols-3`) and an **invite tile** is appended after the last listing.
- **Otherwise:** the existing `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`, no tile.

Eight is two full desktop rows. Below that the grid cannot fill itself, and above it the tile would be pushing into results somebody is actually reading.

**The invite tile** is a dashed-border cell reading *"Got something to sell? Takes about a minute. It stays here until you take it down."* It fills the space with the only thing that genuinely fixes a thin marketplace — more listings — instead of decorating around the gap. It disappears on its own as listings accumulate, and never appears over filtered results, where an empty row means "your filter is narrow", not "the site is new".

Rejected: simply using fewer columns. Two large cards say *"this is all there is"* more loudly than four small ones, and it does nothing about the space beneath.

### The mark: a pin

A pin glyph in an accent-filled rounded square, left of the wordmark, and the same shape as the favicon — replacing the Next.js default still sitting in the browser tab.

It carries the product's whole argument in one shape: **a pin is what a group chat does not have.** It is also the motif this project already earned — the README has called the site a noticeboard since day one — and it survives at 16px in one colour.

Rejected: an abstract four-square "board" mark. It echoes the grid, but a four-square shape reads as *"an app"* rather than as *"a board"*: safer and duller.

## What this needs from the data

The browse query currently selects `id, title, price, imageKeys, type, rentalPeriod, serviceRate, status`. The card adds:

- `category: { select: { name: true } }`
- `condition`
- `createdAt`

All already stored; no schema change.

**Recency is a pure function**, `postedAgo(date, now)`, in `src/lib/listing-labels.ts` with tests: "just now" under an hour, "5h ago", "2d ago", "3w ago", and an absolute date beyond about eight weeks, where "9w ago" stops being useful. It takes `now` as an argument so it is testable without freezing the clock.

## Guardrails

1. **`condition` is nullable** — services have none (Decision Log 2026-08-15). The meta line omits it rather than printing "null" or an em-dash.
2. **The invite tile is not a listing.** It is rendered outside the `listings.map`, so nothing counts it, keys it, or links it as one.
3. **`/listings/mine` and the inbox keep their own card shapes.** This is the browse card only; sweeping the change into pages with different jobs is how the last revamp lost its focus.
4. **The perceived-performance work survives.** `loading.tsx` skeletons must be updated to the new card shape — a 4:3 image inside a bordered card is a different silhouette, and a Neon cold start is 7.3s so the skeleton is seen often.
5. **Spacing stays on the seven-step scale**, with sub-step optical values only inside a component.
6. **Reviewed at 375px and 1280px, light and dark**, and specifically with two listings, with eight, and with a filter that matches nothing.

## Out of scope

- Pagination. Still owed, still unrelated.
- Any change to `/listings/mine`, the inbox, admin or legal.
- A logo for anything other than the header and favicon — no splash, no share images.
