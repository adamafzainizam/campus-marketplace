# Listing cards, the grid, and a mark — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browse listing card with a denser one, make the grid adapt when listings are scarce, and give the site a pin mark and favicon — with a shared `ListingMeta` / `NoPhoto` vocabulary used by browse, `/listings/mine`, the inbox and the listing detail page.

**Architecture:** All new *rules* are pure functions in `src/lib/` with co-located `node:test` suites (`postedAgo`, `priceParts`, `listingMetaParts`, `isSparseBoard`); all new *rendering* is two small server components (`ListingMeta`, `NoPhoto`) plus one mark component (`PinMark`), consumed by pages that keep the layouts their jobs require. No schema change, no new dependency — every field the card adds is already stored.

**Tech Stack:** Next.js 16 App Router (server components), TypeScript, Tailwind v4 with OKLCH tokens in `src/app/globals.css`, Prisma 7, `node:test` with Node's native type-stripping.

## Global Constraints

Copied from `docs/superpowers/specs/2026-08-16-listing-cards-and-identity-design.md` and from `AGENTS.md`. Every task's requirements implicitly include this section.

- **Zero new dependencies.** No component-test framework, no icon package, no spring library. Icons are inline SVG.
- **`condition` is nullable** — services have none. The meta line **omits** it rather than printing "null", "undefined" or a bare em-dash.
- **The invite tile is not a listing.** Render it outside `listings.map`, so nothing counts, keys or links it as one.
- **Spacing stays on the seven-step scale** — `1, 2, 3, 4, 6, 10, 16`. Sub-step optical values (`0.5`, `1.5`, `2.5`, `0.375rem`) are permitted **inside** a component, never between groups. The rule is written at `src/app/globals.css:149-169`.
- **Test-file import rules (Gotchas #21/#23):** files run by `npm test` must use **relative** imports with **explicit `.ts` extensions**, at any depth. `@/` does not resolve there. This is why `src/lib/listing-labels.ts` imports `../generated/prisma/enums.ts` relatively — keep it that way. (The inverse holds under `npm run test:db`, which this plan does not use.)
- **Colour utilities written by hand must be verified in the built CSS (Gotcha #47).** A Tailwind colour utility built from a token that does not exist emits nothing and the page still looks fine.
- **Commit style:** sentence-case imperative summaries, no `feat:`/`fix:` prefixes (match `git log`), body explaining *why*, and the trailer:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```
- **Branch:** work continues on `feature/listing-cards`, which is already checked out and clean. Do not branch again, do not commit to `main`.
- **Commit before mutation-testing anything (Gotcha #50).** No mutation testing is required by this plan; if you add any, commit first.
- **Verification commands** (all must pass before the final PR):
  ```
  npm test
  npx tsc --noEmit
  npx eslint
  npx next build
  ```

---

### Task 1: `postedAgo` — recency as a pure function

**Files:**
- Modify: `src/lib/listing-labels.ts` (append; the file currently ends at line 82)
- Test: `src/lib/listing-labels.test.ts` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: `postedAgo(date: Date, now: Date): string` and `ABSOLUTE_DATE_AFTER_DAYS: number`, both exported from `src/lib/listing-labels.ts`. Task 3 calls `postedAgo`.

**Why `now` is a parameter:** so the function is testable without freezing the clock. Every caller passes one.

**Why UTC getters in the absolute branch:** the output must be deterministic in tests regardless of the machine's timezone. It only affects listings older than eight weeks, where being a few hours off is immaterial. Everything on this page is server-rendered, so there is no server/client hydration mismatch to worry about.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/listing-labels.test.ts`:

```ts
describe("postedAgo", () => {
  const now = new Date("2026-08-16T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  // Under an hour is "just now" rather than "0h ago", which reads like a bug.
  it("says just now under an hour", () => {
    assert.equal(postedAgo(now, now), "just now");
    assert.equal(postedAgo(ago(59 * MINUTE), now), "just now");
  });

  it("counts whole hours up to a day", () => {
    assert.equal(postedAgo(ago(HOUR), now), "1h ago");
    assert.equal(postedAgo(ago(5 * HOUR), now), "5h ago");
    assert.equal(postedAgo(ago(23 * HOUR + 59 * MINUTE), now), "23h ago");
  });

  it("counts whole days up to a week", () => {
    assert.equal(postedAgo(ago(DAY), now), "1d ago");
    assert.equal(postedAgo(ago(6 * DAY + 23 * HOUR), now), "6d ago");
  });

  it("counts whole weeks up to the absolute-date cutoff", () => {
    assert.equal(postedAgo(ago(7 * DAY), now), "1w ago");
    assert.equal(postedAgo(ago(21 * DAY), now), "3w ago");
    assert.equal(postedAgo(ago(55 * DAY), now), "7w ago");
  });

  // Past about two months "9w ago" stops being useful and a date is kinder.
  it("gives an absolute date beyond the cutoff", () => {
    assert.equal(postedAgo(ago(ABSOLUTE_DATE_AFTER_DAYS * DAY), now), "21 Jun 2026");
    assert.equal(postedAgo(new Date("2025-12-31T08:00:00Z"), now), "31 Dec 2025");
  });

  // A listing dated in the future means a clock is wrong somewhere. Saying
  // "just now" is the least wrong thing to render; "-3h ago" is nonsense.
  it("clamps a future date rather than counting backwards", () => {
    assert.equal(postedAgo(new Date("2026-08-17T12:00:00Z"), now), "just now");
  });
});
```

Add the two new names to the existing import block at the top of the file, which currently reads:

```ts
import {
  CONDITION_LABELS,
  LISTING_TYPE_LABELS,
  RENTAL_PERIOD_LABELS,
  formatPrice,
} from "./listing-labels.ts";
```

so that it reads:

```ts
import {
  ABSOLUTE_DATE_AFTER_DAYS,
  CONDITION_LABELS,
  LISTING_TYPE_LABELS,
  RENTAL_PERIOD_LABELS,
  formatPrice,
  postedAgo,
} from "./listing-labels.ts";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test 2>&1 | tail -30`
Expected: FAIL — `SyntaxError` / `The requested module './listing-labels.ts' does not provide an export named 'postedAgo'`.

- [ ] **Step 3: Implement `postedAgo`**

Append to `src/lib/listing-labels.ts`:

```ts
/**
 * Past this many days, a relative age stops being useful — "9w ago" makes a
 * reader do arithmetic — so an absolute date is shown instead.
 */
export const ABSOLUTE_DATE_AFTER_DAYS = 56;

const MONTH_ABBREVIATIONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * How long ago a listing was posted, in the coarsest unit that still says
 * something: "just now", "5h ago", "2d ago", "3w ago", then a date.
 *
 * `now` is a parameter rather than a call to `Date.now()` so this is testable
 * without freezing the clock — the same reason `formatPrice` takes its type
 * rather than reading it back off a listing.
 *
 * The absolute branch reads UTC fields so the output is deterministic wherever
 * the tests run. That is a few hours' difference from Malaysian local time on
 * a date at least eight weeks old, which nobody is reading that closely.
 */
export function postedAgo(date: Date, now: Date): string {
  const elapsedMs = now.getTime() - date.getTime();

  // A future date means a clock is wrong somewhere; counting backwards from it
  // would render "-3h ago". Treat it as brand new instead.
  const minutes = Math.floor(Math.max(elapsedMs, 0) / 60_000);
  if (minutes < 60) return "just now";

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < ABSOLUTE_DATE_AFTER_DAYS) return `${Math.floor(days / 7)}w ago`;

  const month = MONTH_ABBREVIATIONS[date.getUTCMonth()];
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test 2>&1 | tail -20`
Expected: PASS, with the suite count risen by 6.

- [ ] **Step 5: Commit**

```bash
git add src/lib/listing-labels.ts src/lib/listing-labels.test.ts
git commit -m "$(cat <<'EOF'
Add postedAgo, recency as a pure function

The card is gaining a category-condition-recency line, and recency is the
only one of the three that has to be computed rather than looked up. It
takes `now` as an argument so it is testable without freezing the clock,
and falls back to an absolute date past eight weeks, where "9w ago" stops
being something a reader can convert at a glance.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `priceParts` — so the unit can be de-emphasised

**Files:**
- Modify: `src/lib/listing-labels.ts:60-82` (`formatPrice` is re-expressed on top of the new function)
- Test: `src/lib/listing-labels.test.ts` (append)

**Interfaces:**
- Consumes: `RENTAL_PERIOD_LABELS`, `SERVICE_RATE_LABELS` (already in the file).
- Produces:
  ```ts
  export type PriceParts = { amount: string; unit: string | null };
  export function priceParts(
    price: { toString(): string },
    type: ListingType,
    rentalPeriod: RentalPeriod | null,
    serviceRate?: ServiceRate | null,
  ): PriceParts;
  ```
  Task 4 renders `amount` and `unit` in different styles. `formatPrice` keeps its exact existing signature and output — every current caller and every existing test must keep passing untouched.

**Why:** the spec's card puts the price at 17px/700 with the unit de-emphasised. A single pre-joined string cannot be styled in two weights, and splitting it in JSX with `.split(" / ")` would put the formatting rule in two places.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/listing-labels.test.ts`:

```ts
describe("priceParts", () => {
  it("gives a sale price no unit", () => {
    assert.deepEqual(priceParts("25.00", "SALE", null), {
      amount: "RM 25.00",
      unit: null,
    });
  });

  it("splits a rental into amount and unit", () => {
    assert.deepEqual(priceParts("20.00", "RENT", "WEEK"), {
      amount: "RM 20.00",
      unit: "/ week",
    });
  });

  it("splits a service into amount and rate", () => {
    assert.deepEqual(priceParts("30.00", "SERVICE", null, "HOUR"), {
      amount: "RM 30.00",
      unit: "/ hour",
    });
  });

  // FIXED maps to an empty label on purpose: "RM 80" is the whole statement
  // for a whole job, so there must be no unit element to style at all.
  it("gives a fixed-rate service no unit", () => {
    assert.deepEqual(priceParts("80.00", "SERVICE", null, "FIXED"), {
      amount: "RM 80.00",
      unit: null,
    });
  });

  it("falls back to no unit when a rental has no period", () => {
    assert.deepEqual(priceParts("20.00", "RENT", null), {
      amount: "RM 20.00",
      unit: null,
    });
  });

  // The joined string is what every existing caller uses, so the two must not
  // be able to drift: one is defined in terms of the other, and this checks it.
  it("agrees with formatPrice", () => {
    const cases: Array<Parameters<typeof formatPrice>> = [
      ["25.00", "SALE", null, null],
      ["20.00", "RENT", "WEEK", null],
      ["150.00", "RENT", "SEMESTER", null],
      ["30.00", "SERVICE", null, "HOUR"],
      ["80.00", "SERVICE", null, "FIXED"],
    ];
    for (const args of cases) {
      const { amount, unit } = priceParts(...args);
      assert.equal(formatPrice(...args), unit ? `${amount} ${unit}` : amount);
    }
  });
});
```

Add `priceParts` to the import block at the top of the test file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test 2>&1 | tail -30`
Expected: FAIL — no export named `priceParts`.

- [ ] **Step 3: Re-express `formatPrice` on top of `priceParts`**

Replace `src/lib/listing-labels.ts:50-82` (the `formatPrice` doc comment and function) with:

```ts
/** A price split so the unit can be styled differently from the amount. */
export type PriceParts = {
  amount: string;
  /** e.g. "/ week". Null when the price is the whole statement. */
  unit: string | null;
};

/**
 * Splits a price into its amount and its unit.
 *
 * The card renders the amount at full weight and the unit smaller and greyer,
 * which a single joined string cannot express. Splitting it here rather than
 * in JSX keeps one rule in one place: `formatPrice` below is defined in terms
 * of this function, and a test asserts the two agree.
 *
 * Takes anything stringable so it can be handed Prisma's `Decimal` directly —
 * the value must never go through a float, which is why the schema uses
 * Decimal(10,2) in the first place.
 *
 * A rental with no period falls back to a bare price rather than rendering
 * "/ undefined": the data would be wrong, but the page should not be.
 */
export function priceParts(
  price: { toString(): string },
  type: ListingType,
  rentalPeriod: RentalPeriod | null,
  serviceRate: ServiceRate | null = null,
): PriceParts {
  const amount = `RM ${price.toString()}`;

  if (type === "RENT" && rentalPeriod !== null) {
    const period = RENTAL_PERIOD_LABELS[rentalPeriod];
    return { amount, unit: period ? `/ ${period}` : null };
  }

  if (type === "SERVICE" && serviceRate !== null) {
    // FIXED maps to an empty label, so this also covers "no unit wanted".
    const rate = SERVICE_RATE_LABELS[serviceRate];
    return { amount, unit: rate ? `/ ${rate}` : null };
  }

  return { amount, unit: null };
}

/**
 * Renders a price, with its rental or service unit when there is one.
 *
 * The joined form, for everywhere the price is one piece of text.
 */
export function formatPrice(
  price: { toString(): string },
  type: ListingType,
  rentalPeriod: RentalPeriod | null,
  serviceRate: ServiceRate | null = null,
): string {
  const { amount, unit } = priceParts(price, type, rentalPeriod, serviceRate);
  return unit ? `${amount} ${unit}` : amount;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test 2>&1 | tail -20`
Expected: PASS. The pre-existing `formatPrice` tests in `listing-labels.test.ts` and `service-listings.test.ts` must all still pass unchanged — if any of them fails, the refactor changed behaviour and is wrong.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/lib/listing-labels.ts src/lib/listing-labels.test.ts
git commit -m "$(cat <<'EOF'
Split a price into its amount and its unit

The new card sets the price at 17px/700 with "/ week" de-emphasised, which
one joined string cannot express. Splitting it in JSX would have put the
formatting rule in two places, so formatPrice is now defined in terms of
priceParts and a test asserts the two agree on every shape of price.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The shared vocabulary — `listingMetaParts`, `ListingMeta`, `NoPhoto`

**Files:**
- Modify: `src/lib/listing-labels.ts` (append `listingMetaParts`)
- Test: `src/lib/listing-labels.test.ts` (append)
- Create: `src/components/ListingMeta.tsx`
- Create: `src/components/NoPhoto.tsx`

**Interfaces:**
- Consumes: `CONDITION_LABELS`, `postedAgo` (Task 1).
- Produces:
  ```ts
  // src/lib/listing-labels.ts
  export type ListingMetaInput = {
    category: string;
    condition: ListingCondition | null;
    postedAt: Date;
    now: Date;
    extra?: readonly (string | null | undefined)[];
  };
  export function listingMetaParts(input: ListingMetaInput): string[];

  // src/components/ListingMeta.tsx
  export function ListingMeta(
    props: Omit<ListingMetaInput, "now"> & { now?: Date; className?: string },
  ): React.ReactElement | null;

  // src/components/NoPhoto.tsx
  export function NoPhoto(props: { compact?: boolean }): React.ReactElement;
  ```
  Tasks 4, 5, 6 and 7 all import these.

**Why a pure function under the component:** guardrail 1 says a null `condition` must be omitted rather than rendered as "null". A rule with a test beside it is the project's standing pattern (`legal.ts`, `site-copy.ts`, `halal.ts`); there is no component-test framework here, so the omission logic has to live somewhere testable.

**Why `extra`:** the listing detail page also shows quantity ("3 available"). Without a tail slot it would either lose that fact or keep a second ad-hoc meta line beside the shared one, which is exactly the divergence this task exists to remove.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/listing-labels.test.ts`:

```ts
describe("listingMetaParts", () => {
  const now = new Date("2026-08-16T12:00:00Z");
  const postedAt = new Date("2026-08-14T12:00:00Z"); // "2d ago"

  it("reads category, condition, then recency", () => {
    assert.deepEqual(
      listingMetaParts({ category: "Books", condition: "GOOD", postedAt, now }),
      ["Books", "Good", "2d ago"],
    );
  });

  // Services have no condition (the column is nullable for exactly that
  // reason). The line must close up rather than print a gap or "null".
  it("omits a null condition entirely", () => {
    const parts = listingMetaParts({
      category: "Tutoring",
      condition: null,
      postedAt,
      now,
    });
    assert.deepEqual(parts, ["Tutoring", "2d ago"]);
    assert.ok(!parts.join(" · ").includes("null"));
    assert.ok(!parts.join(" · ").includes("undefined"));
  });

  it("appends extra facts after recency", () => {
    assert.deepEqual(
      listingMetaParts({
        category: "Electronics",
        condition: "NEW",
        postedAt,
        now,
        extra: ["3 available"],
      }),
      ["Electronics", "New", "2d ago", "3 available"],
    );
  });

  // quantityLabel returns null for a quantity of one, so the common case
  // hands this function a null it must drop silently.
  it("drops null, undefined and blank extras", () => {
    assert.deepEqual(
      listingMetaParts({
        category: "Furniture",
        condition: null,
        postedAt,
        now,
        extra: [null, undefined, "   "],
      }),
      ["Furniture", "2d ago"],
    );
  });
});
```

Add `listingMetaParts` to the test file's import block.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test 2>&1 | tail -30`
Expected: FAIL — no export named `listingMetaParts`.

- [ ] **Step 3: Implement `listingMetaParts`**

Append to `src/lib/listing-labels.ts`:

```ts
/** What the shared meta line needs to know. See `ListingMeta`. */
export type ListingMetaInput = {
  /** Already resolved for display — the detail page passes the "Other — …" form. */
  category: string;
  /** Null for services, which have no condition. */
  condition: ListingCondition | null;
  postedAt: Date;
  now: Date;
  /** Page-specific facts appended after recency, nulls dropped. */
  extra?: readonly (string | null | undefined)[];
};

/**
 * The `category · condition · recency` line, as a list of parts.
 *
 * Anything absent is *omitted* rather than rendered as an empty slot: a
 * service has no condition, and "Tutoring ·  · 2d ago" is worse than saying
 * less. The joining is left to the caller so the separator lives in one place
 * (`ListingMeta`) and this stays testable as data.
 */
export function listingMetaParts(input: ListingMetaInput): string[] {
  const parts: Array<string | null | undefined> = [
    input.category,
    input.condition ? CONDITION_LABELS[input.condition] : null,
    postedAgo(input.postedAt, input.now),
    ...(input.extra ?? []),
  ];

  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 5: Write the `ListingMeta` component**

Create `src/components/ListingMeta.tsx`:

```tsx
import { listingMetaParts, type ListingMetaInput } from "@/lib/listing-labels";

/**
 * The `category · condition · recency` line, shared by the browse card,
 * `/listings/mine` and the listing detail page.
 *
 * Extracted because those three pages need different *layouts* and the same
 * *vocabulary*, and conflating the two is how a site ends up with three
 * unrelated card designs. Two pages should differ because their content
 * differs, never because they were built on different days.
 *
 * A server component: `new Date()` is evaluated once during the render that
 * produced the listings, so nothing re-renders on the client and there is no
 * hydration mismatch to reconcile.
 */
export function ListingMeta({
  now = new Date(),
  className = "text-fine text-tertiary",
  ...input
}: Omit<ListingMetaInput, "now"> & { now?: Date; className?: string }) {
  const parts = listingMetaParts({ ...input, now });
  if (parts.length === 0) return null;

  return <p className={className}>{parts.join(" · ")}</p>;
}
```

- [ ] **Step 6: Write the `NoPhoto` component**

Create `src/components/NoPhoto.tsx`:

```tsx
/**
 * What a listing with no photograph shows in place of one.
 *
 * The browse grid's emptiest state is a listing nobody photographed, and it
 * used to be a large void with 10px grey text in the middle of it. An icon
 * plus a label reads as a deliberate state rather than as a failed image load.
 *
 * `compact` drops the label for thumbnails too narrow to hold it — the inbox
 * row, mainly. The accessible name is on the wrapper either way, so the label
 * is decoration and never the only thing carrying the meaning.
 */
export function NoPhoto({ compact = false }: { compact?: boolean }) {
  return (
    <span
      role="img"
      aria-label="No photo yet"
      className="flex h-full w-full flex-col items-center justify-center gap-1 text-tertiary"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={compact ? "h-5 w-5" : "h-6 w-6"}
      >
        <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
        <circle cx="8.75" cy="10" r="1.5" />
        <path d="M21 15.5 16.5 11 9 18.5" />
      </svg>
      {!compact && <span className="text-fine">No photo yet</span>}
    </span>
  );
}
```

- [ ] **Step 7: Verify both components compile and lint**

Run: `npx tsc --noEmit && npx eslint src/components/ListingMeta.tsx src/components/NoPhoto.tsx`
Expected: both silent. Neither file needs `"use client"` — they render no state and no handlers.

- [ ] **Step 8: Commit**

```bash
git add src/lib/listing-labels.ts src/lib/listing-labels.test.ts src/components/ListingMeta.tsx src/components/NoPhoto.tsx
git commit -m "$(cat <<'EOF'
Extract the shared card vocabulary: ListingMeta and NoPhoto

Browse, my-listings, the inbox and the detail page need different layouts
and the same vocabulary. Keeping them on separate treatments is what left
the site with a different surface, thumbnail and missing-image state on
every page — the inconsistency the design revamp existed to remove.

The omission rule lives in a pure function with tests beside it, because a
null condition rendering as "null" is exactly the kind of thing that
survives review by looking fine on the one page somebody opened.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: The browse card

**Files:**
- Modify: `src/app/page.tsx:56-65` (query `select`) and `:188-247` (the grid's card markup)
- Modify: `src/app/globals.css:226-233` (`.text-price`; add `.text-price-unit` after it)
- Modify: `src/components/Skeleton.tsx:25-34` (`ListingCardSkeleton`)

**Interfaces:**
- Consumes: `priceParts` (Task 2), `ListingMeta` and `NoPhoto` (Task 3).
- Produces: the card markup Task 5 mirrors in the invite tile's height, and the silhouette the skeleton must match.

**The six facts, per the spec:** image 4:3 inside a raised card; title 14px/600; price 17px/700 with the unit de-emphasised; a `category · condition · recency` meta line; the `--surface-raised` card surface with a border; and `NoPhoto` where there is no photograph.

**Guardrail 4:** the skeleton is seen often — a Neon cold start is 7.3s — so it changes in this same task, never as a follow-up.

- [ ] **Step 1: Restyle the price and add the unit style**

In `src/app/globals.css`, replace the `.text-price` rule (currently lines 222-233, including its comment) with:

```css
/* The most-scanned element on a listing card, so it outranks the title
   rather than sitting below it in size and colour. Display face (set in the
   heading rule above), full strength, tabular so a column of prices does not
   jitter. Raised from 15px/600 to 17px/700 with the card redesign: three
   facts in a grid of two read as a demo, and the price is the one fact
   somebody is actually scanning for. */
.text-price {
  font-size: 1.0625rem;
  line-height: 1.25;
  letter-spacing: -0.011em;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

/* "/ week" is a unit, not a price. At the same weight it competes with the
   number; de-emphasised, the eye lands on "RM 20" and picks the unit up
   afterwards, which is the order the information is actually wanted in. */
.text-price-unit {
  font-size: 0.8125rem;
  font-weight: 550;
  letter-spacing: 0.004em;
  color: var(--text-secondary);
}
```

- [ ] **Step 2: Add the card's fields to the browse query**

In `src/app/page.tsx`, replace the `select` block at lines 56-65 with:

```tsx
      select: {
        id: true,
        title: true,
        price: true,
        imageKeys: true,
        type: true,
        rentalPeriod: true,
        serviceRate: true,
        status: true,
        // The card's meta line. All three are already stored; category,
        // condition and recency are what make a marketplace look used, and a
        // card with three facts in a grid of two reads as a demo.
        condition: true,
        createdAt: true,
        category: { select: { name: true } },
      },
```

Note this stays a `select` rather than an `include` — the audit's S5 finding was over-fetching every column of a relation, and `category: { select: { name: true } }` is the narrow form.

- [ ] **Step 3: Rewrite the card markup**

In `src/app/page.tsx`, add to the imports:

```tsx
import { ListingMeta } from "@/components/ListingMeta";
import { NoPhoto } from "@/components/NoPhoto";
```

and change the `listing-labels` import to bring in `priceParts`:

```tsx
import { LISTING_TYPE_LABELS, priceParts } from "@/lib/listing-labels";
```

`formatPrice` is no longer used in this file — remove it from that import, or `eslint` will fail on the unused binding.

Then replace the whole `<li>…</li>` body inside `listings.map` (lines 191-244) with:

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
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-sunken">
                  {listing.imageKeys[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getImageUrl(listing.imageKeys[0])}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <NoPhoto />
                  )}

                  {listing.type === "RENT" && (
                    <span className="badge badge-accent absolute left-2 top-2 shadow-sm">
                      For rent
                    </span>
                  )}

                  {/* Sold and reserved stay visible, marked — evidence the
                      marketplace is used. Dimmed rather than hidden. */}
                  {listing.status !== "AVAILABLE" && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="badge bg-white text-neutral-900">
                        {statusLabel(listing.status, listing.type)}
                      </span>
                    </span>
                  )}
                </div>

                {/* gap-1 is inside a component, where the spacing is a
                    relationship between three lines of one block rather than
                    a gap between page groups. */}
                <div className="flex flex-col gap-1 p-3">
                  <p className="truncate text-sm leading-snug font-semibold">
                    {listing.title}
                  </p>
                  <CardPrice listing={listing} />
                  <ListingMeta
                    category={listing.category.name}
                    condition={listing.condition}
                    postedAt={listing.createdAt}
                    className="truncate text-fine text-tertiary"
                  />
                </div>
              </PendingLink>
            </li>
```

Then add this small component at the bottom of `src/app/page.tsx`, beside `FilterChip`:

```tsx
/**
 * The price, with its unit de-emphasised. A separate component only so the
 * card markup above stays readable — it has no state and no other caller.
 */
function CardPrice({
  listing,
}: {
  listing: {
    price: { toString(): string };
    type: ListingType;
    rentalPeriod: RentalPeriod | null;
    serviceRate: ServiceRate | null;
  };
}) {
  const { amount, unit } = priceParts(
    listing.price,
    listing.type,
    listing.rentalPeriod,
    listing.serviceRate,
  );

  return (
    <p className="text-price">
      {amount}
      {unit && <span className="text-price-unit"> {unit}</span>}
    </p>
  );
}
```

`ListingType` is already imported as a value in this file (it is iterated for the filter chips). Add the two type-only imports it now also needs, on the existing enums import line:

```tsx
import { ListingType, type RentalPeriod, type ServiceRate } from "@/generated/prisma/enums";
```

- [ ] **Step 4: Update the card skeleton to the new silhouette**

In `src/components/Skeleton.tsx`, replace `ListingCardSkeleton` (lines 25-34) with:

```tsx
/** Matches the browse grid's card proportions exactly — a bordered card with
 *  a 4:3 image, a title, a price and a meta line. A silhouette that no longer
 *  matches is worse than none: the layout jumps when the content lands, and a
 *  7.3s cold start means this is on screen often. */
export function ListingCardSkeleton() {
  return (
    <li className="card overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="flex flex-col gap-1 p-3">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-5 w-2/5 rounded" />
        <Skeleton className="h-3.5 w-4/5 rounded" />
      </div>
    </li>
  );
}
```

- [ ] **Step 5: Verify it compiles, lints and builds, and that the new CSS actually emits**

```bash
npx tsc --noEmit && npx eslint && npx next build
grep -c "text-price-unit" .next/static/css/*.css
```
Expected: `tsc` and `eslint` silent, the build succeeds, and the grep reports at least `1`. **Zero means the class emitted nothing** — Gotcha #47. (`.text-price-unit` is literal CSS rather than a Tailwind utility, so it should always emit; the check is cheap and this is the exact class of bug that hid for months last time.)

- [ ] **Step 6: Look at it**

```bash
npm run dev
```
Open `http://localhost:3000` and confirm, at 1280px and at 375px, in light and dark:
- the card is a bordered raised surface with the image clipped to its radius,
- the price outranks the title, and "/ week" on the rental listing is smaller and greyer,
- the meta line reads `Category · Condition · 3d ago` (whatever the dev data says), with no `null` anywhere,
- the listing with no photograph shows the icon and "No photo yet", not a void,
- the "For rent" badge and the sold/reserved scrim still sit correctly over the 4:3 image.

Then hard-reload with the network throttled (DevTools → Network → Slow 3G) and confirm the skeleton has the same silhouette as the card that replaces it — no jump.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/app/globals.css src/components/Skeleton.tsx
git commit -m "$(cat <<'EOF'
Redesign the browse card around six facts instead of three

The revamp changed tokens, type and copy and never changed a component, so
the most repeated element on the site kept its original shape: a bare 1:1
image floating on the page under a title and a price smaller than it.

Six facts now: a 4:3 image inside a raised card, a title at 14/600, the
price at 17/700 with its unit de-emphasised, and a category-condition-
recency line. All three new facts were already in the database. Category,
condition and recency are what make a marketplace look used.

The skeleton changes in the same commit rather than after it — a 4:3 image
inside a bordered card is a different silhouette, and a Neon cold start is
7.3 seconds, so it is seen often.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The adaptive grid and the invite tile

**Files:**
- Create: `src/lib/browse-board.ts`
- Create: `src/lib/browse-board.test.ts`
- Modify: `src/lib/site-copy.ts` (append the invite copy)
- Modify: `src/lib/site-copy.test.ts` (extend `everything`, add one test)
- Modify: `src/app/globals.css` (add `.invite-tile` inside `@layer components`)
- Modify: `src/app/page.tsx` (grid classes and the tile)

**Interfaces:**
- Consumes: nothing from earlier tasks except the card markup it sits beside.
- Produces:
  ```ts
  export const SPARSE_BOARD_MAX = 8;
  export function isSparseBoard(listingCount: number, filtered: boolean): boolean;
  export const BOARD_INVITE: { title: string; body: string };
  ```

**The rule, verbatim from the spec:** `sparse = listings.length < 8 && no filter is active`. When sparse, the grid caps at three columns and an invite tile is appended after the last listing; otherwise the existing four-column grid, no tile.

**Why eight:** two full desktop rows. Below that the grid cannot fill itself; above it the tile would push into results somebody is reading.

**Why never over filtered results:** an empty row after a filter means "your filter is narrow", not "the site is new", and inviting someone to post in response to a failed search answers a question they did not ask.

- [ ] **Step 1: Write the failing tests for the rule**

Create `src/lib/browse-board.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SPARSE_BOARD_MAX, isSparseBoard } from "./browse-board.ts";

describe("isSparseBoard", () => {
  it("is sparse below two full desktop rows", () => {
    assert.equal(isSparseBoard(2, false), true);
    assert.equal(isSparseBoard(7, false), true);
  });

  // Eight is two full rows of four. At that point the grid fills itself and
  // the tile would be pushing into results somebody is reading.
  it("stops at the threshold", () => {
    assert.equal(isSparseBoard(SPARSE_BOARD_MAX, false), false);
    assert.equal(isSparseBoard(60, false), false);
  });

  // An empty row under a filter means "your filter is narrow", not "the site
  // is new" — and answering a failed search with an invitation to post is
  // answering a question nobody asked.
  it("is never sparse while a filter is active", () => {
    assert.equal(isSparseBoard(0, true), false);
    assert.equal(isSparseBoard(2, true), false);
    assert.equal(isSparseBoard(7, true), false);
  });

  it("holds the threshold at eight", () => {
    assert.equal(SPARSE_BOARD_MAX, 8);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test 2>&1 | tail -20`
Expected: FAIL — `Cannot find module './browse-board.ts'`.

- [ ] **Step 3: Implement the rule**

Create `src/lib/browse-board.ts`:

```ts
/**
 * When the board is too thin to fill itself, and what to do about it.
 * No I/O.
 *
 * Relative imports with explicit extensions if any are ever added — this
 * module is reached by a test (Gotchas #21/#23).
 */

/**
 * Two full desktop rows. Below this the four-column grid renders half a row
 * of content and then a viewport of nothing, which is what "empty and
 * lifeless" actually was — it was diagnosed as chrome-versus-content and
 * treated by reclaiming ninety pixels of filter chips, which measured the
 * wrong thing.
 */
export const SPARSE_BOARD_MAX = 8;

/**
 * Whether the grid should adapt to a thin board: fewer columns, plus an
 * invitation to post in the space that is left.
 *
 * Filtered results are never sparse, however few of them there are. Few
 * results under a filter is information about the filter, and the honest
 * response is "try a broader category", not "post something".
 *
 * A count of zero is technically sparse and never reaches this branch — the
 * page renders its empty-state card instead of a grid. Left in rather than
 * special-cased, so the function matches the rule as specified.
 */
export function isSparseBoard(listingCount: number, filtered: boolean): boolean {
  return !filtered && listingCount < SPARSE_BOARD_MAX;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 5: Add the invite copy, with its voice test**

Append to `src/lib/site-copy.ts`:

```ts
/* --------------------------------------------------------------- the invite tile */

/**
 * Shown in the browse grid while the board is thin, in place of decorating
 * around the gap. The only thing that genuinely fixes a thin marketplace is
 * more listings, so the space asks for one.
 *
 * A state of possibility, so it gets the point of view — and the second
 * sentence is the product's argument again: a listing here outlives the
 * twenty minutes it would survive in a group chat.
 */
export const BOARD_INVITE = {
  title: "Got something to sell?",
  body: "Takes about a minute. It stays here until you take it down.",
};
```

In `src/lib/site-copy.test.ts`, add `BOARD_INVITE` to the import block, add its two strings to the `everything` array:

```ts
  BOARD_INVITE.title,
  BOARD_INVITE.body,
```

and append this suite:

```ts
describe("the invite tile", () => {
  test("makes the permanence argument rather than just asking", () => {
    // "Post a listing" is a button label. This is the space where a thin
    // board would otherwise say nothing, so it should say why bothering is
    // worth it — which is the same argument the tagline makes.
    assert.match(BOARD_INVITE.body, /until you take it down/i);
  });

  test("stays short enough to sit in a grid cell", () => {
    assert.ok(
      BOARD_INVITE.body.length <= 80,
      `invite body is ${BOARD_INVITE.body.length} characters`,
    );
  });
});
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test 2>&1 | tail -20`
Expected: PASS. If "nothing shouts" fails, the copy has an exclamation mark in it — fix the copy, not the test.

- [ ] **Step 7: Add the `.invite-tile` class**

In `src/app/globals.css`, inside `@layer components`, immediately after the `.dropzone*` rules (which end around line 592) and before the `.prose` block, add:

```css
  /* The invite tile.
     A dashed cell in the browse grid while the board is thin. Dashed for the
     same reason .dropzone is: it is the near-universal signal for "something
     goes here", which is precisely the statement. Not .dropzone itself —
     that one means "drop a file", and one class meaning two things is how a
     design system starts to lie.

     It fills the gap with the only thing that actually fixes a thin
     marketplace, and disappears on its own as listings accumulate. */
  .invite-tile {
    display: flex;
    height: 100%;
    min-height: 11rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 1rem;
    text-align: center;
    border: 1.5px dashed var(--border-strong);
    border-radius: var(--radius-lg);
    color: var(--text-secondary);
    transition:
      border-color var(--response-fast) var(--ease-out),
      color var(--response-fast) var(--ease-out);
  }
  @media (hover: hover) {
    .invite-tile:hover { border-color: var(--accent); color: var(--text); }
  }
```

- [ ] **Step 8: Wire the grid and the tile into the page**

In `src/app/page.tsx`, add to the imports:

```tsx
import { isSparseBoard } from "@/lib/browse-board";
```

and add `BOARD_INVITE` to the existing `@/lib/site-copy` import block.

After the `filtered` line (currently line 76), add:

```tsx
  // Two listings in a four-column grid is half a row of content and then a
  // viewport of nothing. Below two full rows the grid narrows and the space
  // that remains asks for a listing instead of sitting empty.
  const sparse = isSparseBoard(listings.length, filtered);
```

Replace the `<ul>` opening tag of the grid with:

```tsx
        <ul
          className={`grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5${
            sparse ? "" : " md:grid-cols-4"
          }`}
        >
```

and immediately **after** the closing `))}` of `listings.map` — outside it, so nothing counts, keys or links the tile as a listing — add:

```tsx
          {sparse && (
            <li>
              <Link href="/listings/new" className="invite-tile">
                <span className="text-sm font-semibold text-content">
                  {BOARD_INVITE.title}
                </span>
                <span className="text-fine">{BOARD_INVITE.body}</span>
              </Link>
            </li>
          )}
```

`Link` is already imported in this file.

- [ ] **Step 9: Verify, including the branch you cannot see with the dev data**

```bash
npx tsc --noEmit && npx eslint && npx next build
grep -c "invite-tile" .next/static/css/*.css
```
Expected: silent, successful, and the grep at least `1`.

Then `npm run dev` and check all three states named in guardrail 6, at 375px and 1280px, light and dark:

1. **Thin board** — `http://localhost:3000` with the dev database's two listings: three columns maximum on desktop, and the invite tile immediately after the last card, the same height as its neighbours.
2. **Full board** — the dev database does not have eight listings, and seeding fake ones to look at a CSS branch is not worth it. Instead, temporarily set `SPARSE_BOARD_MAX = 1` in `src/lib/browse-board.ts`, reload, and confirm the grid goes to four columns on desktop with **no** tile. **Then put it back to 8** and confirm `npm test` passes again — the test asserting the threshold is 8 is what stops this edit shipping.
3. **No matches** — `http://localhost:3000/?q=zzzzznothing`: the empty-state card, and no invite tile anywhere on the page.

- [ ] **Step 10: Commit**

```bash
git add src/lib/browse-board.ts src/lib/browse-board.test.ts src/lib/site-copy.ts src/lib/site-copy.test.ts src/app/globals.css src/app/page.tsx
git commit -m "$(cat <<'EOF'
Adapt the grid when the board is thin, and ask for a listing

"Empty and lifeless" was diagnosed as chrome versus content and treated by
reclaiming ninety pixels of filter chips. That measured the wrong thing:
the problem is two listings in a four-column grid — half a row of content
and then a viewport of nothing.

Below two full rows the grid caps at three columns and an invite tile takes
the space that is left, which fills it with the only thing that genuinely
fixes a thin marketplace instead of decorating around the gap. It goes away
on its own as listings accumulate.

Never over filtered results: an empty row under a filter means the filter
is narrow, not that the site is new, and answering a failed search with an
invitation to post answers a question nobody asked.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `/listings/mine` adopts the vocabulary

**Files:**
- Modify: `src/app/listings/mine/page.tsx:21-37` (query) and `:62-126` (row markup)
- Modify: `src/components/Skeleton.tsx:49-60` (`RowSkeleton`)

**Interfaces:**
- Consumes: `ListingMeta`, `NoPhoto` (Task 3).
- Produces: nothing new.

**Scope:** the row layout **stays a row** — it carries status and actions a grid cell has no room for. What changes is the vocabulary: the 4:3 thumbnail, `NoPhoto`, and the shared meta line. The page already uses the `.card` surface, so that part is done.

- [ ] **Step 1: Add the meta line's fields to the query**

In `src/app/listings/mine/page.tsx`, replace the `select` block (lines 23-34) with:

```tsx
    select: {
      id: true,
      title: true,
      price: true,
      imageKeys: true,
      type: true,
      rentalPeriod: true,
      serviceRate: true,
      status: true,
      createdAt: true,
      // The shared meta line, same as the browse card.
      condition: true,
      category: { select: { name: true } },
      _count: { select: { conversations: true } },
    },
```

(This also fixes the stray indentation on the existing `serviceRate` line.)

- [ ] **Step 2: Adopt the thumbnail, `NoPhoto` and `ListingMeta`**

Add to the imports:

```tsx
import { ListingMeta } from "@/components/ListingMeta";
import { NoPhoto } from "@/components/NoPhoto";
```

Replace the thumbnail block (lines 68-77) with:

```tsx
              {/* 4:3 and the same missing-photo state as every other page.
                  It was a bare 96px square that rendered nothing at all when
                  a listing had no photograph. */}
              <div className="aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-sunken">
                {listing.imageKeys[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getImageUrl(listing.imageKeys[0])}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <NoPhoto compact />
                )}
              </div>
```

Then, directly after the title/price row's closing `</div>` (line 95) and **before** the status paragraph, insert:

```tsx
                <ListingMeta
                  category={listing.category.name}
                  condition={listing.condition}
                  postedAt={listing.createdAt}
                />
```

The meta line goes above the status line deliberately: the meta describes the listing, the status line describes the seller's business with it, and identity before administration is the order somebody scanning their own listings reads in.

- [ ] **Step 3: Update `RowSkeleton` to match**

In `src/components/Skeleton.tsx`, replace the thumbnail line inside `RowSkeleton`:

```tsx
      <Skeleton className="h-24 w-24 shrink-0 rounded-lg" />
```

with:

```tsx
      <Skeleton className="aspect-[4/3] w-32 shrink-0 rounded-lg" />
```

and add a fourth line to its body so the meta line is represented — replace the inner column with:

```tsx
      <div className="flex flex-1 flex-col gap-2 py-1">
        <Skeleton className="h-4 w-1/2 rounded" />
        <Skeleton className="h-3.5 w-2/3 rounded" />
        <Skeleton className="h-3.5 w-1/4 rounded" />
        <Skeleton className="mt-auto h-8 w-40 rounded" />
      </div>
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npx eslint && npx next build
```
Expected: all silent/successful.

Then `npm run dev`, sign in, and open `http://localhost:3000/listings/mine` at 375px and 1280px, light and dark. Confirm: the thumbnail is 4:3 and bordered, a listing with no photo shows the icon (no label at this width is correct), the meta line reads `Category · Condition · 3d ago`, and the row still stacks sensibly on a phone with the status controls reachable.

- [ ] **Step 5: Commit**

```bash
git add src/app/listings/mine/page.tsx src/components/Skeleton.tsx
git commit -m "$(cat <<'EOF'
Bring my-listings onto the shared card vocabulary

The layout stays a row — it carries status and actions a grid cell has no
room for — but there was no defence for it using a different thumbnail
shape and rendering an empty grey square where a listing had no photo.

Same 4:3 thumbnail, same NoPhoto, same meta line as the browse card. The
meta sits above the status line because the meta describes the listing and
the status describes the seller's business with it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: The inbox adopts `NoPhoto` and the thumbnail treatment

**Files:**
- Modify: `src/app/messages/page.tsx:40-49` (thumbnail)
- Modify: `src/app/messages/loading.tsx:12` (skeleton thumbnail)

**Interfaces:**
- Consumes: `NoPhoto` (Task 3).
- Produces: nothing new.

**Scope, per the spec: `NoPhoto` and the thumbnail treatment, nothing more.** A conversation is not a listing — it has no condition and no category — so it gets no meta line, and the list rows stay rows. The conversation thread page is **not touched at all**: its height contract has broken twice from changes made elsewhere (Gotchas #33, #37), and nothing here needs it.

- [ ] **Step 1: Adopt the thumbnail treatment**

In `src/app/messages/page.tsx`, add:

```tsx
import { NoPhoto } from "@/components/NoPhoto";
```

and replace the thumbnail block (lines 40-49) with:

```tsx
                {/* Same treatment as every other listing thumbnail on the
                    site. It was a 56px square that rendered a blank grey box
                    when the listing had no photograph — the one state this
                    site has most of. */}
                <div className="aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-sunken">
                  {conversation.listingImageKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getImageUrl(conversation.listingImageKey)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <NoPhoto compact />
                  )}
                </div>
```

- [ ] **Step 2: Match the skeleton**

In `src/app/messages/loading.tsx`, replace line 12:

```tsx
              <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
```

with:

```tsx
              <Skeleton className="aspect-[4/3] w-20 shrink-0 rounded-lg" />
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npx eslint && npx next build
```
Expected: silent/successful.

Then `npm run dev`, sign in, open `http://localhost:3000/messages` at 375px and 1280px, light and dark. Confirm the row still fits on a phone with the title, the unread badge and the last message legible — the thumbnail grew from 56px to 80px wide, so this is the width worth actually looking at rather than assuming.

If the dev account has no conversations, the empty-state card renders instead and there is nothing to check; say so plainly rather than reporting a check that did not happen. The `docs/friend-session-checklist.md` session covers the inbox with real data.

- [ ] **Step 4: Commit**

```bash
git add src/app/messages/page.tsx src/app/messages/loading.tsx
git commit -m "$(cat <<'EOF'
Give the inbox the same thumbnail and missing-photo state

A conversation is not a listing, so the rows stay rows and gain no meta
line — there is no condition or category to show. But there was no reason
for the thumbnail to be a different shape from every other one on the site,
or for a listing with no photograph to render as a blank grey box here
while the browse grid says "No photo yet".

The conversation thread itself is deliberately untouched.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: The listing detail page adopts `ListingMeta`

**Files:**
- Modify: `src/app/listings/[id]/page.tsx:38-58` (query), `:80-82` (no-photo placeholder), `:108-120` (the ad-hoc meta line)

**Interfaces:**
- Consumes: `ListingMeta`, `NoPhoto` (Task 3).
- Produces: nothing new.

**Note on the category:** this page passes the *resolved* display name — `categoryDisplayName(...)` turns the catch-all into "Other — nasi lemak" when the seller said what they meant. `ListingMeta` takes an already-resolved string precisely so this page can do that without the browse card having to fetch the slug and free-text column too.

- [ ] **Step 1: Add `createdAt` to the query**

In `src/app/listings/[id]/page.tsx`, inside the `select` block, add after `imageKeys: true,`:

```tsx
      createdAt: true,
```

While there, fix the stray indentation on the `serviceRate: true,` line (line 49) so it lines up with its siblings.

- [ ] **Step 2: Replace the ad-hoc meta line**

Add to the imports:

```tsx
import { ListingMeta } from "@/components/ListingMeta";
import { NoPhoto } from "@/components/NoPhoto";
```

Replace the paragraph at lines 108-120 — the one rendering category, condition and quantity by hand — with:

```tsx
          {/* The same line as the browse card and my-listings, plus the one
              fact particular to this page. It was an ad-hoc third treatment
              of the same three facts. */}
          <ListingMeta
            category={categoryDisplayName(
              listing.category.name,
              listing.category.slug,
              listing.otherCategory,
            )}
            condition={listing.condition}
            postedAt={listing.createdAt}
            extra={[quantityLabel(listing.quantity)]}
            className="text-fine text-secondary"
          />
```

`CONDITION_LABELS` is now unused in this file — remove it from the `@/lib/listing-labels` import, or `eslint` fails. Check whether `quantityLabel` and `categoryDisplayName` remain used elsewhere in the file before touching their imports (they are used only here, but the compiler is the authority: run `npx tsc --noEmit` and `npx eslint`).

- [ ] **Step 3: Give the no-photo case the shared placeholder**

Replace the empty placeholder div at lines 80-82:

```tsx
        ) : (
          <div className="aspect-square w-full overflow-hidden rounded-lg border border-line bg-surface-sunken shadow-sm" />
        )}
```

with:

```tsx
        ) : (
          // Square rather than 4:3, matching the gallery it stands in for on
          // this page — the two states of the same slot should be the same
          // shape. It was an empty grey box that read as a broken image.
          <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-sunken shadow-sm">
            <NoPhoto />
          </div>
        )}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npx eslint && npx next build
```
Expected: silent/successful.

Then `npm run dev` and open a listing at `http://localhost:3000/listings/<id>` — one with a photo and one without, at 375px and 1280px, light and dark. Confirm the meta line reads `Category · Condition · 3d ago` (plus `· N available` where the seller set a quantity), that a service listing omits the condition rather than showing a gap, and that the no-photo listing shows the icon and label.

- [ ] **Step 5: Commit**

```bash
git add "src/app/listings/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
Put the listing detail page on the shared meta line

It had a third treatment of the same three facts, assembled inline with its
own separators and its own null handling. It now uses ListingMeta like the
other two pages, passing the resolved category name so "Other — nasi lemak"
still reads the way the seller meant it, with quantity appended as the one
fact particular to this page.

The missing-photo state was an empty grey box that read as a broken image.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: The pin mark and the favicon

**Files:**
- Create: `src/components/PinMark.tsx`
- Create: `src/app/icon.svg`
- Delete: `src/app/favicon.ico`
- Modify: `src/components/SiteHeader.tsx:23-29` (the brand link)

**Interfaces:**
- Consumes: nothing.
- Produces: `export function PinMark(props: { className?: string })`.

**Why a pin:** it carries the product's whole argument in one shape — a pin is what a group chat does not have — it is the motif the README has used since day one, and it survives at 16px in one colour. The rejected alternative was an abstract four-square "board" mark, which reads as "an app" rather than as "a board".

**On the file conventions (verified against `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`):** `app/icon.svg` is picked up automatically and emitted as `<link rel="icon" href="/icon?…" sizes="any">`. `favicon.ico` is deleted rather than left in place — Next would emit both, browsers prefer the `.ico`, and the whole point is to stop shipping the create-next-app default. The CSP is `img-src 'self' …`, which covers a same-origin `/icon.svg`; no policy change is needed, and none should be made (three production outages have come from that one policy).

**The colour is baked, not tokenised:** an SVG served as a favicon has no access to the page's CSS custom properties. `#7544cd` is `oklch(52% 0.20 295)` — the light-mode `--accent` — converted through this project's own `src/lib/color-contrast.ts` rather than eyeballed. It reads on both a light and a dark browser tab strip.

- [ ] **Step 1: Write the mark component**

Create `src/components/PinMark.tsx`:

```tsx
/**
 * The site's mark: a pushpin in an accent-filled rounded square.
 *
 * It carries the product's argument in one shape — a pin is the thing a
 * group chat does not have — and it is the motif this project has used since
 * the README's first line about a noticeboard. It survives at 16px in one
 * colour, which an abstract four-square "board" mark also would have, but
 * that one reads as "an app" rather than as "a board".
 *
 * The same glyph is duplicated in `src/app/icon.svg` for the browser tab.
 * That file cannot import this one — it is a static asset with no access to
 * the page's tokens — so if the shape changes, change both.
 */
export function PinMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-accent text-accent-contrast ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[62%] w-[62%]">
        {/* Cap, tapered body, needle — a pushpin seen side-on. Drawn from
            primitives rather than one clever path so it stays legible when
            somebody has to adjust it. */}
        <rect x="8" y="3" width="8" height="2.4" rx="1.2" />
        <path d="M10 5.4h4l1.7 6.5a1 1 0 0 1-.97 1.25H9.27a1 1 0 0 1-.97-1.25L10 5.4z" />
        <rect x="11.3" y="13.15" width="1.4" height="7.85" rx="0.7" />
      </svg>
    </span>
  );
}
```

- [ ] **Step 2: Put the mark in the header**

In `src/components/SiteHeader.tsx`, add:

```tsx
import { PinMark } from "@/components/PinMark";
```

and replace the brand link (lines 23-29) with:

```tsx
        <Link
          href="/"
          className="pressable mr-auto flex items-center gap-2 text-[0.9375rem] font-semibold tracking-[-0.01em] sm:text-base"
        >
          <PinMark className="h-7 w-7" />
          {/* The wordmark is one colour now: the mark carries the accent, and
              an accent square beside accent text is two things competing to
              be the first thing you look at. */}
          <span>GMI Campus Marketplace</span>
        </Link>
```

Note `items-baseline` became `items-center` — a baseline-aligned box next to text sits visibly low.

- [ ] **Step 3: Write the favicon**

Create `src/app/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="GMI Campus Marketplace">
  <!-- #7544cd is oklch(52% 0.20 295), the light-mode --accent, converted with
       src/lib/color-contrast.ts. A favicon has no access to CSS custom
       properties, so the value is baked; it reads on a light or dark tab. -->
  <rect width="32" height="32" rx="7" fill="#7544cd"/>
  <g fill="#fcfcfc" transform="translate(4 4)">
    <rect x="8" y="3" width="8" height="2.4" rx="1.2"/>
    <path d="M10 5.4h4l1.7 6.5a1 1 0 0 1-.97 1.25H9.27a1 1 0 0 1-.97-1.25L10 5.4z"/>
    <rect x="11.3" y="13.15" width="1.4" height="7.85" rx="0.7"/>
  </g>
</svg>
```

- [ ] **Step 4: Remove the scaffold favicon**

```bash
git rm src/app/favicon.ico
```

- [ ] **Step 5: Verify the mark reads at the size it will actually be seen**

```bash
npx tsc --noEmit && npx eslint && npx next build
grep -o 'rel="icon"[^>]*' .next/server/app/index.html 2>/dev/null || echo "check in the browser instead"
```

Then `npm run dev` and:
- confirm the header mark sits level with the wordmark at 375px and 1280px, light and dark,
- open `http://localhost:3000/icon.svg` directly and confirm it renders — a pushpin, not a smudge,
- **zoom the browser out or open the SVG in a tab and look at the tab icon itself at 16px.** This is the check that matters: if the glyph reads as a blob at 16px, thicken the cap (`height="2.4"` → `3`) and the needle (`width="1.4"` → `1.8`) in **both** files and look again. Do not ship a mark you have not seen small.
- confirm the browser tab no longer shows the Next.js default.

- [ ] **Step 6: Commit**

```bash
git add src/components/PinMark.tsx src/components/SiteHeader.tsx src/app/icon.svg
git commit -m "$(cat <<'EOF'
Give the site a pin mark, and the tab something other than Next's default

A pin is what a group chat does not have, which is the product's whole
argument in one shape, and it is the motif the README has used since its
first line about a noticeboard. It survives at 16px in one colour. The
rejected alternative was an abstract four-square mark echoing the grid,
which reads as "an app" rather than as "a board".

The wordmark drops its accent colour: the mark carries it now, and an
accent square beside accent text is two things competing for the eye.

The glyph is duplicated in src/app/icon.svg because a favicon has no access
to the page's tokens — the accent is baked as #7544cd, converted with this
project's own colour module rather than eyeballed. favicon.ico is deleted
rather than left beside it, since browsers prefer the .ico and it is the
create-next-app default this replaces.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Whole-site review, documentation, and the pull request

**Files:**
- Modify: `AGENTS.md` (Current State, Decision Log, and Known Gotchas if anything cost real time)
- Modify: `docs/superpowers/specs/2026-08-16-listing-cards-and-identity-design.md:4` (`Status:`)

**Interfaces:** none.

This is the task where the work stops being a diff and becomes something somebody else can pick up. `AGENTS.md`'s standing instruction is that the Decision Log gets the *why*, not just the *what*.

- [ ] **Step 1: Run every verification command and record the actual output**

```bash
npm test 2>&1 | tail -5
npx tsc --noEmit && echo "tsc clean"
npx eslint && echo "eslint clean"
npx next build 2>&1 | tail -15
```
Expected: the suite passes with its new total (365 before this branch, plus the tests added here); the other three clean. **Write the real numbers down** — they go into the `AGENTS.md` update and into the PR body, and a number nobody ran is worse than no number.

- [ ] **Step 2: Do the guardrail-6 review in one pass**

At **375px** and **1280px**, in **light** and **dark**, walk: `/`, `/?q=zzzzznothing`, `/listings/mine`, a listing with a photo, a listing without one, `/messages`. Confirm no horizontal scroll at 375px on any of them, and that the meta line truncates rather than wrapping the card taller than its neighbours.

Note honestly anything you could not check with the dev database (an empty inbox, a service listing that does not exist locally) rather than reporting a check that did not happen.

- [ ] **Step 3: Update the spec's status**

In `docs/superpowers/specs/2026-08-16-listing-cards-and-identity-design.md`, change line 4:

```
**Status:** Approved, not yet implemented
```

to:

```
**Status:** Implemented 2026-08-16 (branch `feature/listing-cards`)
```

- [ ] **Step 4: Update `AGENTS.md`**

Three edits, in the file's own voice:

1. **Current State** — replace the "PICK UP HERE — there is approved, unstarted work" paragraph with what actually shipped: the dense card, the adaptive grid and invite tile, the pin mark and favicon, and the shared `ListingMeta`/`NoPhoto` vocabulary across four pages. Update the test count. Keep the paragraph beneath it about *why* that work existed — the scoping lesson is the durable part.

2. **Decision Log** — one dated entry, `2026-08-16`, covering the decisions this branch actually made rather than restating the spec:
   - the meta line's omission rule lives in a pure function because there is no component-test framework here, so "a null condition must not render as null" needs somewhere it can be checked;
   - `.invite-tile` is a separate class from `.dropzone` despite looking identical, because one class meaning two things is how a design system starts to lie;
   - the mark's glyph is deliberately duplicated between `PinMark.tsx` and `icon.svg`, since a favicon cannot reach the page's tokens — with the consequence stated, that changing one means changing both;
   - the browse card shows the plain category name while the detail page resolves "Other — …", which is the spec's call and is worth recording as deliberate rather than as an oversight somebody later "fixes".

3. **Known Gotchas** — add an entry **only if something in this branch cost real time**. Do not invent one. A candidate, if it bit: a Tailwind colour utility that emitted nothing (the existing #47 already covers it — extend rather than duplicate).

- [ ] **Step 5: Commit the documentation**

```bash
git add AGENTS.md docs/superpowers/specs/2026-08-16-listing-cards-and-identity-design.md docs/superpowers/plans/2026-08-16-listing-cards-and-identity.md
git commit -m "$(cat <<'EOF'
Record the card work and close the spec

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Push and open the pull request**

```bash
gh auth status
```
If that reports `skibidam` as the active account, run `gh auth switch --user adamafzainizam` before continuing — an earlier successful `gh` call is not evidence the right account is still active, and it has drifted mid-session before.

```bash
eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_ed25519_new
git push -u origin feature/listing-cards
gh pr create --base main --title "Redesign the listing card, adapt the grid, and give the site a mark" --body "$(cat <<'EOF'
The five-phase design revamp changed tokens, type, copy and consistency and
never changed a single component — so the listing card, the most repeated
element on the site, was in no phase's scope. This is that scope.

**The card.** Six facts instead of three: a 4:3 image inside a raised card, a
title at 14/600, the price at 17/700 with its unit de-emphasised, and a
category-condition-recency line. Every new fact was already in the database.

**The grid.** Below two full desktop rows, and only when no filter is active,
the grid caps at three columns and an invite tile takes the space that is
left. "Empty and lifeless" had been diagnosed as chrome-versus-content and
treated by reclaiming ninety pixels of filter chips; the real problem was two
listings in a four-column grid.

**The mark.** A pushpin in an accent square, in the header and as the favicon,
replacing the create-next-app default in the browser tab.

**One vocabulary, three layouts.** `ListingMeta` and `NoPhoto` are shared by
browse, `/listings/mine`, the inbox and the listing detail page. Each page
keeps the layout its job requires — a conversation list is rows, not cards —
but nothing differs merely because it was built on a different day.

Spec: `docs/superpowers/specs/2026-08-16-listing-cards-and-identity-design.md`
Plan: `docs/superpowers/plans/2026-08-16-listing-cards-and-identity.md`

**Verified:** `npm test` (<N> passing), `tsc --noEmit`, `eslint` and
`next build` all clean. Reviewed at 375px and 1280px, light and dark, with a
thin board, a full board and a filter matching nothing.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Replace `<N>` with the real number from Step 1.

---

## Self-review

**Spec coverage.** The card (Task 4), the grid and invite tile (Task 5), the pin mark and favicon (Task 9), `ListingMeta` and `NoPhoto` (Task 3) applied to browse (4), `/listings/mine` (6), the inbox (7) and the listing detail page (8); the three query additions — `category.name`, `condition`, `createdAt` — in Task 4; `postedAgo` with the spec's five output shapes in Task 1. Guardrail 1 is a test in Task 3; guardrail 2 is the tile's placement outside `listings.map` in Task 5 step 8; guardrail 3 is Tasks 6-8 existing at all; guardrail 4 is the skeleton edits folded into Tasks 4, 6 and 7 rather than deferred; guardrail 5 is the Global Constraints; guardrail 6 is Task 10 step 2. Out-of-scope items — pagination, admin and legal, re-laying-out the inbox or my-listings, share images — appear in no task.

**One thing the spec left implicit, resolved here:** de-emphasising the price unit needs the price split, which the spec does not mention. Task 2 adds `priceParts` and keeps `formatPrice` passing its existing tests unchanged.

**Type consistency.** `postedAgo(date, now)` (Task 1) is called by `listingMetaParts` (Task 3) and nowhere else. `ListingMetaInput` requires `now`; the component makes it optional and defaults it — the one place the two signatures deliberately differ, stated in Task 3's Interfaces block. `priceParts` returns `{ amount, unit }`, consumed under exactly those names in Task 4's `CardPrice`. `NoPhoto`'s only prop is `compact`, passed by Tasks 6 and 7 and omitted by Tasks 4 and 8. `isSparseBoard(listingCount, filtered)` and `SPARSE_BOARD_MAX` are used in Task 5 only.
