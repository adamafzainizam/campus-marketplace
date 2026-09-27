# Overhaul Phase 3: Browse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the browse page in the notice-board language: a highlighter headline, a segmented type filter, the listing card with a split meta line, striped no-photo fill, a "Service" tag and a pinned "Sold" stamp, plus empty and loading states to match.

**Architecture:** One pure addition to `src/lib/listing-labels.ts` (`cardMetaParts`) splits the card's meta line into facts and recency, tested like `listingMetaParts`. The headline's highlighted word becomes two exported copy constants in `site-copy.ts`, so the page never slices a string. Everything visual is new component classes in `globals.css` (`.photo-missing`, `.stamp`, `.segmented`/`.segment`, `.headline-mark`) built only from existing tokens, used by `src/app/page.tsx`, `NoPhoto`, `ListingMeta` and the skeletons. No new dependencies, no client components.

**Tech Stack:** Next.js 16 App Router (Server Components), React 19, Tailwind v4, `@phosphor-icons/react` (already installed, SSR path `@phosphor-icons/react/ssr`), `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-27-notice-board-overhaul-design.md`, section 2 "Phase 3: Browse", including the two *Amended in Phase 3* notes. Visual reference: `docs/superpowers/specs/assets/2026-09-27-notice-board/reference.png`. Phases 1 and 2 are merged: tokens (`--line`, `--control-line`, `--highlight`, `--on-highlight`, `--surface-raised`, `--surface-sunken`, `--text*`, `--shadow-sm/md/lg`), classes (`.card`, `.card-interactive`, `.chip`, `.badge-highlight`, `.badge-outline`, `.invite-tile`, `.skeleton`) and `ICON_WEIGHT` in `src/components/icon-style.ts` all exist.

## Global Constraints

- Branch: `feature/overhaul-3-browse` (already checked out). Never commit on `main`.
- **Never stage `README.md` or `docs/case-study.md`** (the builder's uncommitted edits). Always `git add` explicit paths, never `git add -A` or `git add .`.
- Colour only through existing tokens/utilities. No literal colours (`#…`, `rgb(`, `oklch(`, named colours, `bg-black/50`, `bg-white`, `text-neutral-*`) in components or new CSS. `color-mix()` of two tokens is allowed.
- In light mode yellow (`--highlight`) is never text and never a hairline on a light surface; only a fill with `--on-highlight` text on it.
- Radius 3px (`var(--radius)` / Tailwind `rounded`), 2px for tags (`var(--radius-sm)` / `rounded-sm`). Borders 1.5px. Shadows are hard offsets from `--shadow-*`. No pills.
- Motion CSS-only; transitions only on `transform`, `box-shadow`, `opacity`, `background-color`, `border-color`.
- Button labels never wrap (`.btn` already has `white-space: nowrap`).
- At most one middle dot (`·`) per visible line.
- No em-dash (`—`) or en-dash (`–`) in any visible UI string you add or touch. Code comments may use them.
- Do not change routes, query-parameter names, `browseHref`, `parseListingTypeFilter`, `isSparseBoard`, the Prisma query, or any label function's wording (`LISTING_TYPE_LABELS`, `statusLabel`, `CONDITION_LABELS`).
- Do not change the conversation thread page or `.thread-viewport` rules (Known Gotchas #33, #37).
- Tests: relative imports with explicit `.ts` extensions (Gotchas #20, #21, #23).
- Every task ends with all four green: `npm test`, `npx tsc --noEmit`, `npx eslint .`, `npx next build`.
- Any new CSS class: after `npx next build`, run `ls .next/static/chunks/*.css` to print the real path, then grep it for the class (Gotcha #47). Do not grep `.next/static/css`.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`

## Taste-skill rules that apply (design-taste-frontend)

Design read: overhaul of a peer-to-peer campus marketplace, printed notice-board language, project tokens + Tailwind v4. Dials: VARIANCE 5, MOTION 4, DENSITY 5. Rules in force for this phase: one accent (the highlighter), one radius system, zero em-dashes in touched copy, at most one `·` per line, skeleton loaders shaped like the real content, empty states that say how to populate, every control keyboard-operable with a visible focus ring, `prefers-reduced-motion` respected (the global block already zeroes transitions), both themes checked. Tags on photos ("For rent", "Service") are **semantic** state, not the decorative overlays the skill bans. No hero photograph (recorded exception).

## File map

| File | Responsibility | Task |
|---|---|---|
| `src/lib/listing-labels.ts` | add `cardMetaParts`, share a part-cleaning helper | 1 |
| `src/lib/listing-labels.test.ts` | its tests | 1 |
| `src/components/ListingMeta.tsx` | `layout="split"` variant | 1 |
| `src/components/NoPhoto.tsx` | striped fill, "No photo", `bare` prop | 2 |
| `src/app/globals.css` | `.photo-missing`, `.stamp` | 2 |
| `src/app/page.tsx` | card markup | 2 |
| `src/lib/site-copy.ts`, `src/lib/site-copy.test.ts` | headline lead/mark, empty-state em-dash | 3 |
| `src/app/globals.css` | `.headline-mark`, `.segmented`, `.segment` | 3 |
| `src/app/page.tsx` | hero, segmented filter, spacing, empty state | 3 |
| `src/components/Skeleton.tsx`, `src/app/loading.tsx` | skeletons matching the new page | 4 |

---

### Task 1: The card's split meta line

**Files:**
- Modify: `src/lib/listing-labels.ts` (around `listingMetaParts`, lines ~210-241)
- Modify: `src/components/ListingMeta.tsx`
- Test: `src/lib/listing-labels.test.ts` (new `describe("cardMetaParts")` after `describe("listingMetaParts")`)

**Interfaces:**
- Consumes: existing `ListingMetaInput`, `postedAgo`, `CONDITION_LABELS` in `listing-labels.ts`.
- Produces:
  - `export type CardMetaParts = { facts: string[]; recency: string }`
  - `export function cardMetaParts(input: ListingMetaInput): CardMetaParts` — `facts` is category, then condition label, then each `extra`, blanks dropped; `recency` is `postedAgo(postedAt, now)`.
  - `ListingMeta` accepts `layout?: "line" | "split"` (default `"line"`, current behaviour unchanged). `"split"` renders facts left (joined with `" · "`, `--text-secondary`, truncating) and recency right (`--text-tertiary`, never truncating).

- [ ] **Step 1: Write the failing test**

Add `cardMetaParts` to the existing import list at the top of `src/lib/listing-labels.test.ts`, then append:

```ts
describe("cardMetaParts", () => {
  const now = new Date("2026-08-16T12:00:00Z");
  const postedAt = new Date("2026-08-14T12:00:00Z"); // "2d ago"

  it("puts category and condition on the left and recency on its own", () => {
    assert.deepEqual(
      cardMetaParts({ category: "Books", condition: "GOOD", postedAt, now }),
      { facts: ["Books", "Good"], recency: "2d ago" },
    );
  });

  // The card shows the facts joined by a middle dot and recency in its own
  // right-aligned slot, so a browse card can never carry more than one dot.
  it("gives a browse card at most one separator", () => {
    const { facts } = cardMetaParts({ category: "Books", condition: "GOOD", postedAt, now });
    assert.equal(facts.join(" · ").split("·").length - 1, 1);
  });

  it("omits a null condition, as a service has none", () => {
    assert.deepEqual(
      cardMetaParts({ category: "Tutoring", condition: null, postedAt, now }),
      { facts: ["Tutoring"], recency: "2d ago" },
    );
  });

  it("appends extras to the facts, not to recency", () => {
    assert.deepEqual(
      cardMetaParts({
        category: "Electronics",
        condition: "NEW",
        postedAt,
        now,
        extra: ["3 available", null, "  "],
      }),
      { facts: ["Electronics", "New", "3 available"], recency: "2d ago" },
    );
  });

  // Same data, same vocabulary: the split must not drift from the one-line
  // form the detail page and /listings/mine still use.
  it("carries exactly the parts listingMetaParts does", () => {
    const input = { category: "Furniture", condition: "FAIR" as const, postedAt, now, extra: ["2 available"] };
    const { facts, recency } = cardMetaParts(input);
    assert.deepEqual([...facts, recency].sort(), listingMetaParts(input).sort());
  });
});
```

(`"FAIR"` must be a real `ListingCondition` value; check `CONDITION_LABELS` in `listing-labels.ts` and use any existing key if it is not.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test 2>&1 | grep -E "cardMetaParts|fail|pass" | head`
Expected: FAIL, `cardMetaParts` is not exported.

- [ ] **Step 3: Implement**

In `src/lib/listing-labels.ts`, replace `listingMetaParts` with a shared cleaner plus both functions:

```ts
/** Trims each part and drops anything absent or blank. */
function presentParts(parts: ReadonlyArray<string | null | undefined>): string[] {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);
}

/**
 * The `category · condition · recency` line, as a list of parts.
 *
 * Anything absent is *omitted* rather than rendered as an empty slot: a
 * service has no condition, and "Tutoring ·  · 2d ago" is worse than saying
 * less. The joining is left to the caller so the separator lives in one place
 * (`ListingMeta`) and this stays testable as data.
 */
export function listingMetaParts(input: ListingMetaInput): string[] {
  return presentParts([
    input.category,
    input.condition ? CONDITION_LABELS[input.condition] : null,
    postedAgo(input.postedAt, input.now),
    ...(input.extra ?? []),
  ]);
}

export type CardMetaParts = { facts: string[]; recency: string };

/**
 * The same parts, split for the browse card: facts on the left, recency in
 * its own right-aligned slot. The notice-board card allows one middle dot per
 * line, and "Books · Good · 2d ago" spends two; moving recency to the other
 * end of the row keeps the information and drops the second dot.
 */
export function cardMetaParts(input: ListingMetaInput): CardMetaParts {
  return {
    facts: presentParts([
      input.category,
      input.condition ? CONDITION_LABELS[input.condition] : null,
      ...(input.extra ?? []),
    ]),
    recency: postedAgo(input.postedAt, input.now),
  };
}
```

Replace `src/components/ListingMeta.tsx` with:

```tsx
import { cardMetaParts, listingMetaParts, type ListingMetaInput } from "@/lib/listing-labels";

/**
 * The listing meta line, shared by the browse card, `/listings/mine` and the
 * listing detail page.
 *
 * Extracted because those pages need different *layouts* and the same
 * *vocabulary*, and conflating the two is how a site ends up with three
 * unrelated card designs. Two pages should differ because their content
 * differs, never because they were built on different days.
 *
 * `layout="line"` is `category · condition · recency` on one line.
 * `layout="split"` is the browse card's form: the facts on the left, recency
 * right-aligned, so the line never carries more than one middle dot.
 *
 * A server component: `new Date()` is evaluated once during the render that
 * produced the listings, so nothing re-renders on the client and there is no
 * hydration mismatch to reconcile.
 */
export function ListingMeta({
  now = new Date(),
  layout = "line",
  className,
  ...input
}: Omit<ListingMetaInput, "now"> & {
  now?: Date;
  layout?: "line" | "split";
  className?: string;
}) {
  if (layout === "split") {
    const { facts, recency } = cardMetaParts({ ...input, now });
    return (
      <p className={`flex items-baseline justify-between gap-2 text-fine ${className ?? ""}`}>
        <span className="min-w-0 truncate text-secondary">{facts.join(" · ")}</span>
        <span className="shrink-0 text-tertiary">{recency}</span>
      </p>
    );
  }

  const parts = listingMetaParts({ ...input, now });
  if (parts.length === 0) return null;

  return <p className={className ?? "text-fine text-tertiary"}>{parts.join(" · ")}</p>;
}
```

- [ ] **Step 4: Run tests, types, lint, build**

Run: `npm test && npx tsc --noEmit && npx eslint . && npx next build`
Expected: all green; the new `cardMetaParts` tests pass. Existing callers (`page.tsx`, `listings/mine`, `listings/[id]`) still use the default `"line"` layout and render exactly as before.

- [ ] **Step 5: Mutation check, after committing**

Commit first (Gotcha #50):
```bash
git add src/lib/listing-labels.ts src/lib/listing-labels.test.ts src/components/ListingMeta.tsx
git commit -m "Split the card meta line into facts and recency

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
Then temporarily add `postedAgo(input.postedAt, input.now)` to the end of `cardMetaParts`'s `facts` array, run `npm test`, confirm the "puts category and condition…" and "at most one separator" tests fail, and restore with `git checkout src/lib/listing-labels.ts`. Report the failing test names.

---

### Task 2: The listing card

**Files:**
- Modify: `src/components/NoPhoto.tsx`
- Modify: `src/app/globals.css` (inside `@layer components`, after `.invite-tile`; and the `prefers-contrast: more` border list)
- Modify: `src/app/page.tsx` (the `<li>` card markup inside `listings.map`, lines ~212-267)

**Interfaces:**
- Consumes: `ListingMeta` with `layout="split"` (Task 1); `LISTING_TYPE_LABELS`, `statusLabel` (existing).
- Produces: `NoPhoto({ compact?: boolean; bare?: boolean })`; CSS classes `.photo-missing` and `.stamp`.

Spec, verbatim: *"Photo well 4:3 with a 1.5px bottom border; `NoPhoto` becomes a diagonal-stripe fill in `--surface-sunken` tones with a Phosphor image icon and "No photo"."* *"Title Archivo 600, one line, truncated."* *"Tags on the photo: "For rent" `--highlight`; "Service" ink-outline tag on `--surface-raised`. Sale listings carry no tag."* *"Sold / Reserved / Rented out: a stamp: an ink-bordered, `--surface-raised` label rotated about `-6deg`, Archivo 900 uppercase, centred on the photo, with the photo at reduced opacity. Replaces the current `bg-black/50` veil. The label text still comes from `statusLabel()`."* Amended: stamp has its own 2px offset shadow, border `--text`, photo at 45% opacity in colour, and on a no-photo card the "No photo" label and icon are hidden under the stamp (stripes only).

- [ ] **Step 1: Add the CSS**

Inside `@layer components` in `src/app/globals.css`, directly after the `.invite-tile` hover rule:

```css
  /* A photo well with nothing in it. Diagonal stripes, like the blank
     space on a board where a notice has not been pinned yet, so absence
     reads as a state rather than as an image that failed to load. Two tones
     of the sunken surface: no literal colour, so both themes follow. */
  .photo-missing {
    background: repeating-linear-gradient(
      45deg,
      var(--surface-sunken) 0 10px,
      color-mix(in oklab, var(--surface-sunken), var(--text) 6%) 10px 20px
    );
  }

  /* Sold, Reserved, Rented out. A label pinned over the photo, tilted like
     something stuck on by hand. Its border is --text rather than --line so
     it reads as ink in both themes (--line is a quiet grey in dark), and it
     carries its own offset shadow so it sits *on* the card, not in it. The
     tilt is static, so reduced motion has nothing to remove. */
  .stamp {
    display: inline-block;
    padding: 0.25rem 0.625rem;
    border: 2px solid var(--text);
    border-radius: var(--radius-sm);
    background: var(--surface-raised);
    color: var(--text);
    box-shadow: var(--shadow-sm);
    font-size: 0.875rem;
    font-weight: 900;
    line-height: 1.2;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    /* Wraps rather than clipping: "No longer offered" is wider than a
       phone card's photo well, which has overflow hidden. */
    max-width: calc(100% - 1rem);
    text-align: center;
    transform: rotate(-6deg);
  }
```

- [ ] **Step 2: Rewrite `NoPhoto`**

Replace the body of `src/components/NoPhoto.tsx` (keep its import lines) with:

```tsx
/**
 * What a listing with no photograph shows in place of one.
 *
 * A striped well with an icon and "No photo": the blank space on a board
 * where nothing has been pinned yet. It reads as a deliberate state rather
 * than as a failed image load.
 *
 * `compact` drops the label for thumbnails too narrow to hold it (the inbox
 * row, mainly). `bare` drops the icon and the label too, leaving only the
 * stripes, for when something else is centred on top: the browse card's
 * "Sold" stamp would otherwise collide with them. The accessible name is on
 * the wrapper in every variant, so the visible label is decoration and never
 * the only thing carrying the meaning.
 *
 * The card link this sits inside has no other accessible name of its own, so
 * `role="img"` plus this label becomes the *front* of the link's name: "No
 * photo, Title, RM 25, …". Deliberate: a sighted user sees the same absence
 * before they see the title. A listing with a photo contributes nothing here,
 * because this component only renders in the photo's absence.
 */
export function NoPhoto({
  compact = false,
  bare = false,
}: {
  compact?: boolean;
  bare?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label="No photo"
      className="photo-missing flex h-full w-full flex-col items-center justify-center gap-1 text-secondary"
    >
      {!bare && (
        <ImageIcon
          weight={ICON_WEIGHT}
          aria-hidden="true"
          className={compact ? "h-5 w-5" : "h-6 w-6"}
        />
      )}
      {!compact && !bare && <span className="text-fine font-semibold">No photo</span>}
    </span>
  );
}
```

- [ ] **Step 3: Rewrite the card markup in `src/app/page.tsx`**

Replace the `<li key={listing.id}>…</li>` block inside `listings.map` with the following. Nothing outside that `<li>` changes in this task.

```tsx
            <li key={listing.id}>
              <PendingLink
                href={`/listings/${listing.id}`}
                className="card card-interactive block overflow-hidden"
                innerClassName="block"
                pendingClassName="card-pending"
              >
                {/* 4:3 rather than 1:1. A square crops phone photographs
                    hardest, and it made a listing with no photo a large void
                    instead of a small one. */}
                <div className="relative aspect-[4/3] w-full overflow-hidden border-b-[1.5px] border-line bg-surface-sunken">
                  {listing.imageKeys[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getImageUrl(listing.imageKeys[0])}
                      alt=""
                      loading="lazy"
                      className={`h-full w-full object-cover${
                        listing.status === "AVAILABLE" ? "" : " opacity-45"
                      }`}
                    />
                  ) : (
                    <NoPhoto bare={listing.status !== "AVAILABLE"} />
                  )}

                  {/* Tags say what kind of listing this is. A sale is the
                      default and carries none, so a tag always means
                      something. */}
                  {listing.type === "RENT" && (
                    <span className="badge badge-highlight absolute left-2 top-2 shadow-sm">
                      {LISTING_TYPE_LABELS.RENT}
                    </span>
                  )}
                  {listing.type === "SERVICE" && (
                    <span className="badge badge-outline absolute left-2 top-2 border-content shadow-sm">
                      {LISTING_TYPE_LABELS.SERVICE}
                    </span>
                  )}

                  {/* Sold and reserved stay on the board, stamped: evidence
                      the marketplace is used. The photo fades, in colour, so
                      the stamp is what the eye lands on. */}
                  {listing.status !== "AVAILABLE" && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="stamp">{statusLabel(listing.status, listing.type)}</span>
                    </span>
                  )}
                </div>

                {/* gap-1 is inside a component, where the spacing is a
                    relationship between three lines of one block rather than
                    a gap between page groups. */}
                <div className="flex flex-col gap-1 p-3">
                  <p className="truncate text-sm leading-snug font-semibold sm:text-base">
                    {listing.title}
                  </p>
                  <CardPrice listing={listing} />
                  <ListingMeta
                    layout="split"
                    category={listing.category.name}
                    condition={listing.condition}
                    postedAt={listing.createdAt}
                  />
                </div>
              </PendingLink>
            </li>
```

- [ ] **Step 4: Verify**

Run: `npm test && npx tsc --noEmit && npx eslint . && npx next build`
Then: `ls .next/static/chunks/*.css` and grep that path for `photo-missing`, `.stamp{` (minified; try `stamp`), `opacity-45` and `border-line`. Each must appear at least once; report the counts. Confirm with `grep -n "bg-black\|bg-white\|text-neutral" src/app/page.tsx` that nothing matches.

- [ ] **Step 5: Commit**

```bash
git add src/components/NoPhoto.tsx src/app/globals.css src/app/page.tsx
git commit -m "Notice-board listing card: stamp, stripes, service tag, split meta

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Top of the page: headline, segmented type filter, empty state

**Files:**
- Modify: `src/lib/site-copy.ts`, `src/lib/site-copy.test.ts`
- Modify: `src/app/globals.css` (inside `@layer components`, after `.chip-selected`; and the `prefers-contrast: more` border list)
- Modify: `src/app/page.tsx` (everything above the grid, plus the empty-state block)

**Interfaces:**
- Consumes: nothing from Tasks 1-2 beyond `page.tsx` already containing Task 2's card.
- Produces: `HOME_HEADLINE_LEAD`, `HOME_HEADLINE_MARK` (and `HOME_HEADLINE` kept, equal to their concatenation); CSS `.headline-mark`, `.segmented`, `.segment`, `.segment-selected`.

Spec, verbatim: *"Hero: left-aligned. `HOME_HEADLINE` with "GMI." wrapped in a highlighter `<mark>` (`--highlight` fill, `--on-highlight` text, small horizontal padding); max two lines at every width. `HOME_TAGLINE` below. Then the search field and its button. Top padding no more than `pt-10` so the first row of listings is visible without scrolling at 1280×800 and the first card's top edge is visible at 375×740."* Amended: the lone "Home" breadcrumb is removed from the home page; layout stays stacked (hero, search, type filter, category rail). The type filter is a four-way segmented control on its own row: *"one 1.5px-bordered box with a 2px offset shadow, hairline dividers between segments, the selected segment a `--highlight` fill. Auto width from `sm`, full width with equal segments below it. Each segment stays a link with `aria-current`, inside a labelled group."* Empty states: *"a `.card` with an Archivo 900 heading and one action."*

- [ ] **Step 1: Write the failing copy tests**

In `src/lib/site-copy.test.ts` add `HOME_HEADLINE_LEAD` and `HOME_HEADLINE_MARK` to the import list, then add inside `describe("the pitch", …)`:

```ts
  test("the highlighted word is the end of the headline, not a copy of it", () => {
    // The page renders LEAD then MARK inside a <mark>. If HOME_HEADLINE ever
    // changes on its own, the two would silently disagree.
    assert.equal(HOME_HEADLINE, `${HOME_HEADLINE_LEAD}${HOME_HEADLINE_MARK}`);
    assert.ok(HOME_HEADLINE_LEAD.endsWith(" "), "lead needs its trailing space");
    assert.equal(HOME_HEADLINE_MARK, "GMI.");
  });
```

And add inside `describe("empty states", …)`:

```ts
  test("no em-dash or en-dash in either empty state", () => {
    for (const line of [
      EMPTY_NOTHING_POSTED.title,
      EMPTY_NOTHING_POSTED.body,
      EMPTY_NO_MATCHES.title,
      EMPTY_NO_MATCHES.body,
    ]) {
      assert.ok(!/[—–]/.test(line), `dash in: ${line}`);
    }
  });
```

Run: `npm test 2>&1 | grep -E "not ok|HOME_HEADLINE" | head`
Expected: FAIL (the new exports do not exist; `EMPTY_NOTHING_POSTED.body` contains `—`).

- [ ] **Step 2: Update the copy**

In `src/lib/site-copy.ts` replace the `HOME_HEADLINE` line with:

```ts
/**
 * The headline, in two pieces so the page can put "GMI." under a highlighter
 * without slicing a string. HOME_HEADLINE stays the whole sentence for
 * anything that wants it plain.
 */
export const HOME_HEADLINE_LEAD = "Buy, sell and rent around ";
export const HOME_HEADLINE_MARK = "GMI.";
export const HOME_HEADLINE = `${HOME_HEADLINE_LEAD}${HOME_HEADLINE_MARK}`;
```

and change `EMPTY_NOTHING_POSTED.body` to:

```ts
  body: "Be first. It will still be here next week, which is more than the group chat can manage.",
```

Run: `npm test` — expected PASS.

- [ ] **Step 3: Add the CSS**

Inside `@layer components` in `src/app/globals.css`, directly after the `.chip-selected` rule:

```css
  /* The one highlighted word in the home headline, marked the way you would
     mark it on paper. A fill with ink on it, never yellow text. clone keeps
     the padding on both halves if the word ever wraps. */
  .headline-mark {
    background: var(--highlight);
    color: var(--on-highlight);
    padding: 0 0.12em;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }

  /* The listing-type filter. Four answers to one question, so one control
     rather than four loose chips: a single bordered box with hairlines
     between the answers and the current one filled. Each segment is a link,
     so it works without JavaScript and keeps its URL. The box does not press
     in; a segment darkens instead, because moving a quarter of a control
     would tear it. Full width with equal segments on a phone, so four labels
     fit a 343px column without scrolling. */
  .segmented {
    display: inline-flex;
    border: 1.5px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface-raised);
    box-shadow: var(--shadow-sm);
  }
  .segment {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.75rem;
    padding: 0.5rem 1rem;
    color: var(--text);
    font-size: 0.875rem;
    font-weight: 700;
    white-space: nowrap;
    transition: background-color var(--response-fast) var(--ease-out);
    touch-action: manipulation;
  }
  .segment + .segment { border-left: 1.5px solid var(--line); }
  .segment:first-child {
    border-top-left-radius: calc(var(--radius) - 1.5px);
    border-bottom-left-radius: calc(var(--radius) - 1.5px);
  }
  .segment:last-child {
    border-top-right-radius: calc(var(--radius) - 1.5px);
    border-bottom-right-radius: calc(var(--radius) - 1.5px);
  }
  /* Lift the focused segment so its ring is not painted over by the next
     segment's background. */
  .segment:focus-visible { z-index: 1; }
  .segment:active { background: var(--surface-sunken); }
  @media (hover: hover) {
    .segment:hover { background: var(--surface-sunken); }
  }
  .segment-selected,
  .segment-selected:hover,
  .segment-selected:active {
    background: var(--highlight);
    color: var(--on-highlight);
  }
  @media (width < 40rem) {
    .segmented { display: flex; width: 100%; }
    .segment { flex: 1 1 0; padding-inline: 0.5rem; }
  }
```

Then in the `@media (prefers-contrast: more)` block, add `.segmented` to the selector list that gets `border-width: 2px` (the list starting `.btn-primary, .btn-secondary, .field, .chip, .card, …`), and add this rule inside the same media block:

```css
  .segment + .segment { border-left-width: 2px; }
```

- [ ] **Step 4: Rewrite the top of the page**

In `src/app/page.tsx`:

1. Remove the `Breadcrumbs` import and the `<Breadcrumbs items={[]} />` line. (It named only the page you are on, and cost a row above the fold.)
2. In the `@/lib/site-copy` import, replace `HOME_HEADLINE` with `HOME_HEADLINE_LEAD` and `HOME_HEADLINE_MARK`.
3. Replace everything from the `{/* Spacing carries the grouping … */}` comment down to (but not including) `{listings.length === 0 ? (` with:

```tsx
      {/* Spacing carries the grouping: mt-1 because the headline and tagline
          are one thought, mt-3 because the sign-in line is a separate one.
          The whole band is budgeted so the first row of listings is on
          screen at 1280x800 without scrolling: the listings are the page. */}
      <section className="mb-6">
        <h1>
          {HOME_HEADLINE_LEAD}
          <mark className="headline-mark">{HOME_HEADLINE_MARK}</mark>
        </h1>
        <p className="mt-1 text-secondary">{HOME_TAGLINE}</p>
        {!session?.user && (
          <p className="mt-3 text-fine text-tertiary">
            Anyone can browse.{" "}
            <Link href="/signin" className="link">
              Sign in with your {ALLOWED_DOMAIN_LABEL} account
            </Link>{" "}
            to post or message a seller.
          </p>
        )}
      </section>

      <form className="mb-3 flex flex-col gap-2.5 sm:flex-row" action="/" method="get">
        <label htmlFor="q" className="sr-only">
          Search listings
        </label>
        <input
          id="q"
          type="search"
          name="q"
          defaultValue={query}
          placeholder={SEARCH_PLACEHOLDER}
          className="field min-w-0 flex-1"
        />
        {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
        {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
        <button type="submit" className="btn btn-secondary">
          Search
        </button>
      </form>

      {/* Sale, rent or service is one question with four answers, so it is
          one segmented control rather than a row of loose chips, and it sits
          on its own row rather than beside the search: search is "what", this
          is "what kind", and the rail below is "where". */}
      <div role="group" aria-label="Listing type" className="segmented mb-3">
        <TypeSegment href={browseHref(active, { type: undefined })} selected={!typeFilter}>
          Everything
        </TypeSegment>
        {Object.values(ListingType).map((value) => (
          <TypeSegment
            key={value}
            href={browseHref(active, { type: value })}
            selected={typeFilter === value}
          >
            {LISTING_TYPE_LABELS[value]}
          </TypeSegment>
        ))}
      </div>

      {/* One scrolling row at every width. Wrapping seventeen chips put three
          rows of controls above the fold on desktop, which is most of why a
          page with four listings read as empty: chrome outweighing content.
          A mask-image fade was considered as a scroll affordance and dropped:
          it would dim the focus ring of a chip near the edge. */}
      <div className="rail -mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          <FilterChip
            href={browseHref(active, { category: undefined })}
            selected={!categorySlug}
          >
            All
          </FilterChip>
          {categories.map((category) => (
            <FilterChip
              key={category.id}
              href={browseHref(active, { category: category.slug })}
              selected={categorySlug === category.slug}
            >
              {category.name}
            </FilterChip>
          ))}
        </div>
      </div>
```

4. Replace the empty-state `<p className="text-display">` element with an `<h2 className="text-display">` (same children), so the empty state has a real heading. Leave the rest of the empty-state block as it is.

5. Add this component below `FilterChip` at the end of the file:

```tsx
function TypeSegment({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <PendingLink
      href={href}
      aria-current={selected ? "true" : undefined}
      className={`segment${selected ? " segment-selected" : ""}`}
    >
      {children}
    </PendingLink>
  );
}
```

The outer page wrapper `<div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">` is unchanged (`sm:py-10` is the spec's `pt-10` cap).

- [ ] **Step 5: Verify**

Run: `npm test && npx tsc --noEmit && npx eslint . && npx next build`
Then `ls .next/static/chunks/*.css` and grep that path for `headline-mark`, `segmented`, `segment-selected`. Report counts. Run `grep -c "Breadcrumbs" src/app/page.tsx` (expected 0) and `grep -n "—\|–" src/app/page.tsx src/lib/site-copy.ts` and report any hits that are in visible strings (comments are fine; `INBOX_EMPTY` is Phase 6/8's and may be left).

- [ ] **Step 6: Commit**

```bash
git add src/lib/site-copy.ts src/lib/site-copy.test.ts src/app/globals.css src/app/page.tsx
git commit -m "Browse hero with highlighted GMI, segmented type filter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Loading skeletons that match the new page

**Files:**
- Modify: `src/components/Skeleton.tsx` (`ListingCardSkeleton` only; leave `RowSkeleton` for Phase 4)
- Modify: `src/app/loading.tsx`

**Interfaces:**
- Consumes: the page structure from Tasks 2-3 (no breadcrumb; headline; tagline; search row; segmented control on its own row; rail; grid).
- Produces: nothing new.

Spec: *"`loading.tsx`: skeleton cards matching the new card, including the offset shadow."* `.skeleton` is the same shape and radius as what it stands in for.

- [ ] **Step 1: Update `ListingCardSkeleton`**

Replace it in `src/components/Skeleton.tsx` with:

```tsx
/** Matches the browse card exactly: a bordered, shadowed card with a 4:3
 *  photo well ruled off at the bottom, a title, a price, and the split meta
 *  row (facts left, recency right). A silhouette that no longer matches is
 *  worse than none: the layout jumps when the content lands, and a 7.3s cold
 *  start means this is on screen often. */
export function ListingCardSkeleton() {
  return (
    <li className="card overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full border-b-[1.5px] border-line" />
      <div className="flex flex-col gap-1 p-3">
        <Skeleton className="h-4 w-3/4 rounded-sm sm:h-5" />
        <Skeleton className="h-5 w-2/5 rounded-sm" />
        <div className="flex justify-between gap-2">
          <Skeleton className="h-3.5 w-1/2 rounded-sm" />
          <Skeleton className="h-3.5 w-8 rounded-sm" />
        </div>
      </div>
    </li>
  );
}
```

- [ ] **Step 2: Rewrite `src/app/loading.tsx`**

```tsx
import { LoadingRegion, ListingGridSkeleton, Skeleton } from "@/components/Skeleton";

/* Mirrors the browse page band for band (headline, tagline, search, the
   type control, the category rail, the grid) with the same spacing, so the
   page lands without shifting. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <LoadingRegion label="Loading listings">
        <div className="mb-6">
          <Skeleton className="h-9 w-4/5 max-w-xl rounded sm:h-10" />
          <Skeleton className="mt-1 h-5 w-3/5 max-w-xs rounded" />
        </div>
        <div className="mb-3 flex flex-col gap-2.5 sm:flex-row">
          <Skeleton className="h-11 min-w-0 flex-1 rounded" />
          <Skeleton className="h-11 w-full rounded sm:w-24" />
        </div>
        <Skeleton className="mb-3 h-11 w-full rounded sm:w-80" />
        <div className="mb-6 flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[2.125rem] w-24 shrink-0 rounded" />
          ))}
        </div>
        <ListingGridSkeleton />
      </LoadingRegion>
    </div>
  );
}
```

> *Amended after review:* the bar heights above are glyph sizes, not line boxes, so the page would still shift 30-60px when content lands. Text bars are sized with `h-[1lh]` inside a wrapper carrying the real type classes (title, `.text-price`, `.text-fine`, `h1` scale with `h-[2lh] sm:h-[1lh]`, tagline); field, button and segmented bars are `h-[2.875rem]`; the rail wrapper gets `.rail` plus bottom padding matching the real rail; the segmented bar is `sm:w-[23rem]`. The signed-out sign-in line is not mirrored, because `loading.tsx` cannot know the session.

- [ ] **Step 3: Verify**

Run: `npm test && npx tsc --noEmit && npx eslint . && npx next build`
Then `grep -rn "ListingCardSkeleton\|ListingGridSkeleton" src` and confirm the only consumers are `src/app/loading.tsx` and `Skeleton.tsx` itself (if another loading file uses them, report it and check that page still reads correctly with the new card silhouette).

- [ ] **Step 4: Commit**

```bash
git add src/components/Skeleton.tsx src/app/loading.tsx
git commit -m "Browse skeleton matches the notice-board page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## After the tasks (Opus, not a subagent)

1. **Seed** the development database temporarily with one SOLD listing with a photo, one RESERVED listing with no photo, one SERVICE listing and one rental, so every card state renders. Record the ids; delete them afterwards.
2. **Screenshots** against `next dev`, forcing the scheme (Gotcha #52: `--blink-settings=preferredColorScheme=1` light, `=0` dark), at 1280×800 and 375×740: confirm the first row is above the fold at 1280×800 and the first card's top edge at 375×740; stamps, stripes, tags and the segmented control in both themes; keyboard focus on a segment (tab to it) visible in both themes.
3. **Loading state**: screenshot `loading.tsx` rendered alone or observed during a cold navigation.
4. **AGENTS.md**: Current State banner (Phase 3 in review), Decision Log (segmented control; stamp choice; no Home breadcrumb on home; the no-hero-photograph exception), Next Steps §0, any new gotcha.
5. **Final review** of the whole branch against the spec, then push and open the PR (`GITHUB_TOKEN= gh pr create`).
