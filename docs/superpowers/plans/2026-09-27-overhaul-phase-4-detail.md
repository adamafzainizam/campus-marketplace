# Overhaul Phase 4: Listing Detail and My Listings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put `/listings/mine` on the browse card (plus an owner control strip), and rebuild the listing detail page in the notice-board language: framed gallery, status/type/quantity tags, a notice for the not-available state, and Message seller and Report in one row.

**Architecture:** The browse card moves out of `src/app/page.tsx` into `src/components/ListingCard.tsx`, unchanged. Browse renders it as one link; `/listings/mine` passes `controls`, which turns the root into a plain card holding the link plus a control strip (controls cannot live inside a link). The detail page is restyled in place. One new tag class, `.badge-ink`. No new dependencies, no data or route changes.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-27-notice-board-overhaul-design.md`, section 2 "Phase 4", including the *Amended in Phase 4* notes. Phase 3 (on `feature/overhaul-3-browse`, PR #53) is the base: `.stamp`, `.photo-missing`, `NoPhoto bare`, `ListingMeta layout="split"`, `ListingCardSkeleton` sized in `lh`.

## Global Constraints

- Branch: `feature/overhaul-4-detail` (already checked out, stacked on `feature/overhaul-3-browse`). Never commit on `main`.
- **Never stage `README.md` or `docs/case-study.md`** (the builder's uncommitted edits). Always `git add` explicit paths.
- Colour only through existing tokens/utilities. No literal colours in components or new CSS.
- In light mode yellow (`--highlight`) is never text and never a hairline on a light surface; only a fill with `--on-highlight` text.
- Radius 3px (`rounded`), 2px for tags (`rounded-sm`). Borders 1.5px. Shadows are hard offsets (`shadow-sm` 2px, `shadow-md` 3px). No pills.
- Button labels never wrap; let the button row wrap instead.
- At most one middle dot (`·`) per visible line.
- No em-dash or en-dash in any visible string you add or touch. Do not change any existing copy except where a step says so. Label wording comes from the existing functions (`statusLabel`, `LISTING_TYPE_LABELS`, `quantityLabel`, `halalDisplayLabel`, `HALAL_NOT_VERIFIED`, `categoryDisplayName`).
- Do not change routes, server actions, Prisma queries beyond the `select` fields a step names, or `ListingStatusControl`'s behaviour.
- Do not touch the conversation thread, forms (`ListingForm`, the edit page), admin or legal pages.
- Every interactive element keeps a visible focus ring. A link inside an `overflow-hidden` card must draw its ring inside itself (`focus-visible:outline-offset-[-3px]`), or the card clips it.
- Tests: relative imports with explicit `.ts` extensions (Gotchas #20, #21, #23).
- Every task ends with `npm test`, `npx tsc --noEmit`, `npx eslint .`, `npx next build` all green. New classes: grep the compiled CSS at the path `ls .next/static/chunks/*.css` prints (Gotcha #47).
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`

## Taste-skill rules that apply (design-taste-frontend)

Dials 5 / 4 / 5. One accent, one radius system, one card design sitewide (the point of this phase), skeletons shaped like the content, empty states with one action, both themes, keyboard focus visible. Tags on photos are semantic state.

## File map

| File | Responsibility | Task |
|---|---|---|
| `src/components/ListingCard.tsx` (new) | The browse card, plus an owner variant with a control strip | 1 |
| `src/app/page.tsx` | Uses `ListingCard` | 1 |
| `src/app/listings/mine/page.tsx` | Grid of `ListingCard` with controls | 2 |
| `src/app/listings/mine/loading.tsx`, `src/components/Skeleton.tsx` | Owner-card skeleton; `RowSkeleton` deleted | 2 |
| `src/app/globals.css` | `.badge-ink` | 3 |
| `src/app/listings/[id]/page.tsx`, `ListingGallery.tsx`, `ContactSellerButton.tsx`, `loading.tsx` | Detail restyle | 3 |
| `src/components/ReportButton.tsx` | `buttonClassName` prop | 3 |

---

### Task 1: Extract the listing card

A pure move: browse must render **byte-for-byte the same markup** afterwards.

**Files:**
- Create: `src/components/ListingCard.tsx`
- Modify: `src/app/page.tsx` (the `<li>` inside `listings.map`, and imports)

**Interfaces:**
- Produces:
  ```ts
  export type CardListing = {
    id: string;
    title: string;
    price: { toString(): string };
    imageKeys: string[];
    type: ListingType;
    rentalPeriod: RentalPeriod | null;
    serviceRate: ServiceRate | null;
    status: ListingStatus;
    condition: ListingCondition | null;
    createdAt: Date;
    category: { name: string };
    /** Present only where the page selected it (the owner's view). */
    quantity?: number;
  };
  export function ListingCard(props: { listing: CardListing; controls?: React.ReactNode }): JSX.Element;
  ```
  Without `controls` the whole card is one `PendingLink` (the browse card, unchanged). Task 1 takes only `{ listing }`; Task 2 adds `controls`.

- [ ] **Step 1: Create `src/components/ListingCard.tsx`**

Move the card markup out of `src/app/page.tsx` verbatim, keeping its comments:

```tsx
import { PendingLink } from "@/components/PendingLink";
import { ListingMeta } from "@/components/ListingMeta";
import { NoPhoto } from "@/components/NoPhoto";
import { CardPrice } from "@/components/CardPrice";
import { getImageUrl } from "@/lib/r2";
import { LISTING_TYPE_LABELS } from "@/lib/listing-labels";
import { statusLabel } from "@/lib/listing-status";
import type {
  ListingCondition,
  ListingStatus,
  ListingType,
  RentalPeriod,
  ServiceRate,
} from "@/generated/prisma/enums";

export type CardListing = {
  id: string;
  title: string;
  price: { toString(): string };
  imageKeys: string[];
  type: ListingType;
  rentalPeriod: RentalPeriod | null;
  serviceRate: ServiceRate | null;
  status: ListingStatus;
  condition: ListingCondition | null;
  createdAt: Date;
  category: { name: string };
  /** Present only where the page selected it (the owner's view). */
  quantity?: number;
};

/**
 * The listing card: browse, and (with `controls`) the seller's own list.
 *
 * One card design sitewide, so a seller sees their listings the way buyers
 * do, and the two cannot drift. `/listings/mine` used to be a second, wide
 * row design that buyers never saw.
 */
export function ListingCard({ listing }: { listing: CardListing }) {
  return (
    <PendingLink
      href={`/listings/${listing.id}`}
      className="card card-interactive block overflow-hidden"
      innerClassName="block"
      pendingClassName="card-pending"
    >
      <CardFace listing={listing} />
    </PendingLink>
  );
}

/** Photo well and the three lines of text; everything inside the link. */
function CardFace({ listing }: { listing: CardListing }) {
  return (
    <>
      {/* ...the photo-well <div> and the text <div> exactly as they are in
          page.tsx today, comments included... */}
    </>
  );
}
```

Replace the `{/* ... */}` placeholder with the two blocks from `page.tsx` (the `<div className="relative aspect-[4/3] …">` photo well with its image/NoPhoto, tags and stamp, and the `<div className="flex flex-col gap-1 p-3">` text block), unchanged.

- [ ] **Step 2: Use it in `src/app/page.tsx`**

The `listings.map` body becomes:

```tsx
          {listings.map((listing) => (
            <li key={listing.id}>
              <ListingCard listing={listing} />
            </li>
          ))}
```

Import `ListingCard` from `@/components/ListingCard`, and remove imports `page.tsx` no longer uses (`getImageUrl`, `ListingMeta`, `NoPhoto`, `CardPrice`, `statusLabel`; keep `PendingLink` and `LISTING_TYPE_LABELS`, which the filters still use; let `tsc`/`eslint` confirm).

- [ ] **Step 3: Prove the markup is unchanged**

Before editing, with `npx next build && npx next start -p 3200` running, save `curl -s http://localhost:3200/ > /tmp/before.html`. After editing, rebuild, restart, save `/tmp/after.html`, and run `diff <(sed 's/[a-z0-9_-]*\.css//g' /tmp/before.html) <(sed 's/[a-z0-9_-]*\.css//g' /tmp/after.html) | head`. Only build hashes may differ; any markup difference is a defect. Stop the server afterwards. (The page reads the development database; that is expected.)

- [ ] **Step 4: Verify and commit**

`npm test && npx tsc --noEmit && npx eslint . && npx next build`, then:
```bash
git add src/components/ListingCard.tsx src/app/page.tsx
git commit -m "Extract the listing card into a shared component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: My listings on the card

**Files:**
- Modify: `src/components/ListingCard.tsx` (the `controls` variant, quantity tag)
- Modify: `src/app/listings/mine/page.tsx`
- Modify: `src/components/Skeleton.tsx` (`ListingCardSkeleton` gains `withControls`; delete `RowSkeleton`)
- Modify: `src/app/listings/mine/loading.tsx`

**Interfaces:**
- Consumes: `ListingCard`, `CardListing` from Task 1; `ListingStatusControl` (unchanged); `quantityLabel(quantity: number): string | null` from `@/lib/listing-quantity` (returns null for 1).
- Produces: `ListingCard({ listing, controls })`; `ListingCardSkeleton({ withControls?: boolean })`; `ListingGridSkeleton({ count?: number; withControls?: boolean })`.

Spec (amended): *"`/listings/mine`: the browse card itself, in the browse grid, plus a control strip under a dashed rule holding the status select, Edit and the conversation count. … The quantity ("3 available") becomes a tag on the photo, so no meta line carries two middle dots."* Both pages widen to `max-w-5xl`.

- [ ] **Step 1: The `controls` variant and quantity tag in `ListingCard.tsx`**

Replace `ListingCard` with:

```tsx
export function ListingCard({
  listing,
  controls,
}: {
  listing: CardListing;
  /** The seller's controls. Present only on /listings/mine. */
  controls?: React.ReactNode;
}) {
  if (!controls) {
    return (
      <PendingLink
        href={`/listings/${listing.id}`}
        className="card card-interactive block overflow-hidden"
        innerClassName="block"
        pendingClassName="card-pending"
      >
        <CardFace listing={listing} />
      </PendingLink>
    );
  }

  // Controls cannot live inside a link, so the owner's card is a plain card
  // holding the link and, below it, the controls. It does not lift or press:
  // half a card moving would tear it. The link draws its focus ring inside
  // itself, because the card's overflow-hidden would clip one drawn outside.
  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <PendingLink
        href={`/listings/${listing.id}`}
        className="block focus-visible:outline-offset-[-3px]"
        innerClassName="block"
        pendingClassName="card-pending"
      >
        <CardFace listing={listing} />
      </PendingLink>
      <div className="mx-3 mt-auto flex flex-wrap items-center gap-2 border-t-[1.5px] border-dashed border-line py-3">
        {controls}
      </div>
    </div>
  );
}
```

In `CardFace`'s photo well, directly after the SERVICE tag, add:

```tsx
                  {/* How many the seller says they have. Only the owner's
                      view selects quantity, so browse never shows it. A tag
                      rather than a third fact in the meta line, which would
                      put two middle dots on one line. */}
                  {listing.quantity !== undefined && quantityLabel(listing.quantity) && (
                    <span className="badge badge-outline absolute right-2 top-2 border-content shadow-sm">
                      {quantityLabel(listing.quantity)}
                    </span>
                  )}
```

and import `quantityLabel` from `@/lib/listing-quantity`.

- [ ] **Step 2: Rewrite the list in `src/app/listings/mine/page.tsx`**

1. Add `quantity: true` to the `select`.
2. Change the page wrapper's `max-w-3xl` to `max-w-5xl`.
3. Replace the empty-state `<p className="text-display">` with `<h2 className="text-display">` (same children), as browse did.
4. Replace the whole `<ul className="flex flex-col gap-4">…</ul>` with:

```tsx
        <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5">
          {listings.map((listing) => (
            <li key={listing.id}>
              <ListingCard
                listing={listing}
                controls={
                  <>
                    <ListingStatusControl
                      listingId={listing.id}
                      status={listing.status}
                      type={listing.type}
                    />
                    <Link
                      href={`/listings/${listing.id}/edit`}
                      className="btn btn-secondary btn-sm"
                    >
                      Edit
                    </Link>
                    {listing._count.conversations > 0 && (
                      <span className="text-fine text-secondary">
                        {listing._count.conversations}{" "}
                        {listing._count.conversations === 1
                          ? "conversation"
                          : "conversations"}
                      </span>
                    )}
                  </>
                }
              />
            </li>
          ))}
        </ul>
```

5. Remove imports no longer used (`getImageUrl`, `ListingMeta`, `NoPhoto`, `CardPrice`, `statusLabel`), add `ListingCard`.

The status text line ("Available · 2 conversations") is gone deliberately: the select shows the status and the stamp shows it on the photo.

- [ ] **Step 3: Skeletons**

In `src/components/Skeleton.tsx`:
- `ListingCardSkeleton` takes `{ withControls = false }: { withControls?: boolean }`. When true, add after the text block, inside the `<li>`:
  ```tsx
      {withControls && (
        <div className="mx-3 flex gap-2 border-t-[1.5px] border-dashed border-line py-3">
          <Skeleton className="h-9 w-24 rounded" />
          <Skeleton className="h-9 w-14 rounded" />
        </div>
      )}
  ```
  (The status select is `h-9`; `.btn-sm` is at least that tall. Check `.btn-sm`'s real height in `globals.css` and match it.)
- `ListingGridSkeleton` takes `{ count = 6, withControls = false }` and passes `withControls` to each card.
- Delete `RowSkeleton` (its only user was `/listings/mine`; confirm with grep).

Rewrite `src/app/listings/mine/loading.tsx`:

```tsx
import { LoadingRegion, ListingGridSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <LoadingRegion label="Loading your listings">
        <Skeleton className="mb-6 h-4 w-40 rounded" />
        <div className="mb-6 flex items-center justify-between gap-3 sm:mb-10">
          <div className="text-display w-48">
            <Skeleton className="h-[1lh] w-full rounded" />
          </div>
          <Skeleton className="h-[2.875rem] w-36 rounded" />
        </div>
        <ListingGridSkeleton count={3} withControls />
      </LoadingRegion>
    </div>
  );
}
```

(Check the real page's header margin and breadcrumb; match them, and say what you matched in the report.)

- [ ] **Step 4: Verify and commit**

`npm test && npx tsc --noEmit && npx eslint . && npx next build`; grep compiled CSS for `outline-offset:-3px` (or however Tailwind prints it) and `border-dashed`. Then:
```bash
git add src/components/ListingCard.tsx src/app/listings/mine/page.tsx src/components/Skeleton.tsx src/app/listings/mine/loading.tsx
git commit -m "My listings on the shared card, with an owner control strip

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: The listing detail page

**Files:**
- Modify: `src/app/globals.css` (`.badge-ink`, inside `@layer components` after `.badge-outline`)
- Modify: `src/app/listings/[id]/page.tsx`
- Modify: `src/app/listings/[id]/ListingGallery.tsx`
- Modify: `src/app/listings/[id]/ContactSellerButton.tsx`
- Modify: `src/components/ReportButton.tsx`
- Modify: `src/app/listings/[id]/loading.tsx`

Spec: *"Detail: two columns from `md` (gallery left, facts right), one column below. Gallery frame with 1.5px border and 3px offset shadow; thumbnails 1.5px-framed, the active one with a 2px `--focus`-coloured outline, offset 1px; they remain buttons, keyboard-navigable as now. … title (display scale), price (large, 900) … Description in `--text-secondary`, 65ch. Message seller primary, Report secondary, in a row that wraps rather than letting a label wrap. Seller line below a dashed 1.5px divider. Seller-only controls (edit, status) and admin takedown keep their current placement, restyled."* Amended: a solid ink status tag leads the tag row when not available; the explanation sits in a neutral notice; the photo stays full strength (no stamp); condition appears once, in the split meta line; tags are status, type and quantity; halal stays a neutral notice.

- [ ] **Step 1: `.badge-ink`**

```css
  /* A state that overrides everything else about the listing (Reserved,
     Sold). Solid ink, the loudest tag there is without using the accent. */
  .badge-ink {
    background: var(--text);
    border-color: var(--text);
    color: var(--surface);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
```

- [ ] **Step 2: `ReportButton` and `ContactSellerButton`**

- `ReportButton`: add an optional prop `buttonClassName = "btn btn-ghost btn-sm"` and use it on the closed-state `<button>`. Existing callers pass nothing and are unchanged.
- `ContactSellerButton`: change the wrapper from `mt-6 flex flex-col gap-2` to `flex flex-col gap-2` (the page's action row now owns the spacing). Leave `w-full sm:w-auto` on the button.

- [ ] **Step 3: Gallery frame**

In `ListingGallery.tsx`, the main image wrapper becomes `aspect-square w-full overflow-hidden rounded border-[1.5px] border-line bg-surface-sunken shadow-md`. Thumbnail buttons keep their current classes except `rounded-sm` stays and the inactive state keeps `border-line`. (They already have the 2px `--focus` outline at offset 1 for the active one.)

- [ ] **Step 4: Rewrite the detail page body**

In `src/app/listings/[id]/page.tsx`:

1. Wrapper `max-w-3xl` → `max-w-5xl`. Grid `grid gap-6 sm:grid-cols-2 sm:gap-10` → `grid gap-6 md:grid-cols-2 md:gap-10`.
2. The no-photo slot: `flex aspect-square w-full items-center justify-center overflow-hidden rounded border-[1.5px] border-line bg-surface-sunken shadow-md`.
3. Replace everything inside `<div className="flex flex-col gap-3">` up to (not including) the `{/* The seller gets management controls … */}` block with:

```tsx
          <h1>{listing.title}</h1>
          <p className="text-price-lg">
            {formatPrice(
              listing.price,
              listing.type,
              listing.rentalPeriod,
              listing.serviceRate,
            )}
          </p>
          {/* The same split line as the card: category and condition on the
              left, recency right. Condition lives here only, not as a tag
              too. text-fine at secondary strength rather than the card's
              default, because here it sits among body-scale prose. */}
          <ListingMeta
            layout="split"
            category={categoryDisplayName(
              listing.category.name,
              listing.category.slug,
              listing.otherCategory,
            )}
            condition={listing.condition}
            postedAt={listing.createdAt}
          />

          {/* Status leads, because it overrides everything else about the
              listing. The photo stays at full strength: on this page it is
              what the reader came to see. */}
          <div className="flex flex-wrap items-center gap-2">
            {listing.status !== "AVAILABLE" && (
              <span className="badge badge-ink">
                {statusLabel(listing.status, listing.type)}
              </span>
            )}
            <span
              className={`badge ${
                listing.type === "RENT" ? "badge-highlight" : "badge-outline border-content"
              }`}
            >
              {LISTING_TYPE_LABELS[listing.type]}
            </span>
            {quantityLabel(listing.quantity) && (
              <span className="badge badge-outline border-content">
                {quantityLabel(listing.quantity)}
              </span>
            )}
          </div>

          {listing.status !== "AVAILABLE" && (
            <p className="notice notice-neutral">
              {listing.status === "RESERVED"
                ? "This item is reserved for someone else, but the deal may still fall through."
                : `This item is no longer available. It has been marked ${statusLabel(
                    listing.status,
                    listing.type,
                  ).toLowerCase()}.`}
            </p>
          )}

          {/* Attributed to the seller, always. This site certifies nothing,
              and a bare "Halal" badge would present a stranger's unverified
              claim about a religious dietary restriction as established fact. */}
          {halalDisplayLabel(listing.halalStatus) && (
            <div className="notice notice-neutral flex-col items-start">
              <p className="font-medium">
                {halalDisplayLabel(listing.halalStatus)}
              </p>
              <p className="mt-1 text-fine">{HALAL_NOT_VERIFIED}</p>
            </div>
          )}

          <p className="max-w-[65ch] whitespace-pre-wrap leading-relaxed text-secondary">
            {listing.description}
          </p>
```

The explaining sentences are the existing copy, moved; do not reword them.

4. Replace the seller-controls / contact / report blocks (everything from `{/* The seller gets management controls …` up to, not including, `{/* Moderation lives on the listing itself …`) with:

```tsx
          {/* One row of actions that wraps rather than letting a label wrap.
              The seller gets management controls instead of a message button:
              they cannot open a thread against themselves, and reporting your
              own listing is refused server-side anyway. */}
          <div className="mt-2 flex flex-wrap items-start gap-3">
            {session?.user?.id === listing.sellerId ? (
              <>
                <Link href={`/listings/${listing.id}/edit`} className="btn btn-secondary">
                  Edit listing
                </Link>
                <Link href="/listings/mine" className="btn btn-secondary">
                  My listings
                </Link>
              </>
            ) : session?.user?.id ? (
              <>
                <ContactSellerButton listingId={listing.id} />
                <ReportButton
                  targetType="LISTING"
                  targetId={listing.id}
                  label="Report this listing"
                  buttonClassName="btn btn-secondary"
                />
              </>
            ) : (
              <Link
                href={`/signin?callbackUrl=/listings/${listing.id}`}
                className="btn btn-primary"
              >
                Sign in to message seller
              </Link>
            )}
          </div>

          <p className="mt-2 border-t-[1.5px] border-dashed border-line pt-3 text-fine text-secondary">
            Listed by {listing.seller.name}
          </p>
```

(`Listed by …` moves from above the actions to below the dashed rule; its wording is unchanged.) The moderation block keeps its placement; change its `border-t border-line` to `border-t-[1.5px] border-line`.

5. Remove imports that become unused (`ListingMeta` is still used; `quantityLabel` still used). Let `tsc`/`eslint` confirm.

- [ ] **Step 5: `loading.tsx` for the detail page**

Rewrite to mirror the new page: `max-w-5xl`, breadcrumb bar, `grid gap-6 md:grid-cols-2 md:gap-10`, a gallery skeleton `aspect-square w-full rounded border-[1.5px] border-line shadow-md`, then in the right column (each text bar `h-[1lh]` inside a wrapper with the real class, as `src/app/loading.tsx` does): an `h1` bar in a `text-display` wrapper, a `text-price-lg` bar, a split meta row in `text-fine`, a row of two tag bars (`h-5 w-16 rounded-sm`), a description block (three `h-[1lh]` bars in a body-text wrapper), an action bar `h-[2.875rem] w-40 rounded`.

- [ ] **Step 6: Verify and commit**

`npm test && npx tsc --noEmit && npx eslint . && npx next build`; grep compiled CSS for `badge-ink`. Confirm `ReportButton`'s other callers (`grep -rn "<ReportButton" src`) pass no `buttonClassName` and so are unchanged. Then:
```bash
git add src/app/globals.css "src/app/listings/[id]/page.tsx" "src/app/listings/[id]/ListingGallery.tsx" "src/app/listings/[id]/ContactSellerButton.tsx" "src/app/listings/[id]/loading.tsx" src/components/ReportButton.tsx
git commit -m "Notice-board listing detail: framed gallery, status tag, one action row

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## After the tasks (Opus)

1. Seed the development database temporarily (a reserved rental with quantity 3 and photos, a sold service with no photo, a food listing with a halal answer), screenshot detail and `/listings/mine` in both themes at 1280 and 375 (`/listings/mine` needs a session: render the page via a signed-in cookie is not available headless, so it goes to the builder's walk), then delete the seed.
2. AGENTS.md: Current State banner, Decision Log (card extraction, detail status tag), Next Steps §0.
3. Final review, then push and open a PR **based on `feature/overhaul-3-browse`** (stacked), retargeting to `main` after #53 merges.
