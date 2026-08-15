# Design Revamp — Phase 3: The display pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the listing detail page, `/listings/mine` and sign-in speak the vocabulary the home page now uses — one heading treatment, one price treatment, one voice — and fix a dead CSS class that has been silently doing nothing in four places.

**Architecture:** No new components and no structural rewrites. This is a consistency pass: each page had invented its own heading size, its own price styling and its own tone, and that divergence *is* the "looks amateur" diagnosis. Copy consolidates into one tested module so the voice rules cover every page rather than only the home page.

**Tech Stack:** Next.js 16 App Router, Tailwind v4, `node:test`. **Zero new dependencies.**

**Spec:** `docs/superpowers/specs/2026-08-16-design-revamp-design.md`

## Scope change from the spec

The spec put the **listing form** in this phase. It is 537 lines covering the photo picker, conditional fields for rent/service/food, validation display and the academic-integrity notice — a different kind of work from display pages, and bundling it produces a plan nobody can review in one sitting. It becomes **Phase 3b**, with `/listings/[id]/edit` alongside it since they share `ListingForm`. Everything still ends deployable.

## Global Constraints

- **Zero new dependencies.**
- **Voice rules** (spec, verbatim): personality only in states of possibility; specific beats generic; second person, present tense; money, halal, suspension and safety stay sober; no exclamation marks.
- **Spacing uses only** Tailwind steps `1, 2, 3, 4, 6, 10, 16`.
- **Legal and consent text is not reworded.** The sign-in page carries a consent line and the `ALLOWED_DOMAIN_LABEL` requirement; presentation may change, meaning may not. `src/lib/legal.ts`'s tests stay green.
- **Every page's `loading.tsx` keeps matching its page.**
- **Reviewed at 375px and 1280px, light and dark.**
- **`npm test` (352) and `npm run test:db` (29) stay green**, plus `tsc --noEmit`, `eslint`, `next build`.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/site-copy.ts` (rename from `home-copy.ts`) | All marketing copy, all pages. |
| `src/lib/site-copy.test.ts` (rename from `home-copy.test.ts`) | Voice rules, now covering every page's strings. |
| `src/app/globals.css` (modify) | `.text-price-lg`; no other changes. |
| `src/app/listings/[id]/page.tsx` (modify) | Price vocabulary, spacing rhythm. |
| `src/app/listings/mine/page.tsx` (modify) | Heading, empty state, card consistency. |
| `src/app/signin/page.tsx` (modify) | Heading, copy. |
| `src/components/Breadcrumbs.tsx`, `src/components/SiteFooter.tsx` (modify) | Dead-class fix. |
| Four `loading.tsx` files (modify) | Kept in step. |
| `AGENTS.md` (modify) | Decision Log, gotcha. |

---

### Task 1: Fix the dead `text-foreground` class

**Files:**
- Modify: `src/app/signin/page.tsx`
- Modify: `src/components/Breadcrumbs.tsx`
- Modify: `src/components/SiteFooter.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. A bug fix.

`text-foreground` is used in four places and **emits no CSS**. The theme defines `--color-content`, not `--color-foreground`, so Tailwind generates nothing and the text silently inherits whatever the parent set. Confirmed by grepping the built stylesheet: zero occurrences, while `text-secondary` is present.

The visible consequences: the `<strong>` on sign-in that is meant to emphasise the required email domain is not emphasised, the current breadcrumb is not full-strength, and the footer links have no hover colour change.

- [ ] **Step 1: Confirm the diagnosis for yourself**

```bash
grep -rn "text-foreground" src/ --include=*.tsx
grep -c "text-foreground" .next/static/chunks/*.css
grep -n "color-content\|color-foreground" src/app/globals.css
```
Expected: four usages; **zero** in built CSS; `--color-content` defined and `--color-foreground` absent. If a build has not been run recently, run `npx next build` first or the second command is meaningless.

- [ ] **Step 2: Replace every usage**

```bash
grep -rl "text-foreground" src/ --include=*.tsx | xargs sed -i 's/text-foreground/text-content/g'
```

Then confirm nothing was missed:
```bash
grep -rn "text-foreground" src/ --include=*.tsx || echo "none left"
```

- [ ] **Step 3: Prove the class now emits CSS**

Run: `npx next build && grep -c "text-content" .next/static/chunks/*.css`
Expected: at least one match. A green build was never evidence here — that is the whole point of the bug.

- [ ] **Step 4: Look at the three places**

Run `npm run dev`. Confirm: on `/signin` the domain in the paragraph is now visibly stronger than the text around it; the last breadcrumb is stronger than its ancestors; footer links change colour on hover.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit && npx eslint && npm test`

```bash
git add src/app/signin/page.tsx src/components/Breadcrumbs.tsx src/components/SiteFooter.tsx
git commit -m "Fix a colour class that has never emitted any CSS

text-foreground was used in four places and generated nothing: the theme
defines --color-content, so Tailwind had no --color-foreground to build a
utility from. The text inherited whatever its parent set, which looked
plausible everywhere and was wrong everywhere.

The visible cost: the sign-in page's emphasis on the required email
domain was not emphasised, the current breadcrumb was not full strength,
and footer links had no hover colour.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: One copy module, one set of voice rules

**Files:**
- Rename: `src/lib/home-copy.ts` → `src/lib/site-copy.ts`
- Rename: `src/lib/home-copy.test.ts` → `src/lib/site-copy.test.ts`
- Modify: `src/app/page.tsx` (import path)

**Interfaces:**
- Consumes: the existing five constants.
- Produces, additionally:
  - `MINE_EMPTY: { title: string; body: string }`
  - `SIGNIN_HEADLINE: string`
  - `SIGNIN_INTRO: string`

The voice rules currently police the home page only. Copy added to other pages would escape them entirely, which defeats the reason the module exists.

- [ ] **Step 1: Rename both files**

```bash
git mv src/lib/home-copy.ts src/lib/site-copy.ts
git mv src/lib/home-copy.test.ts src/lib/site-copy.test.ts
sed -i 's|@/lib/home-copy|@/lib/site-copy|' src/app/page.tsx
sed -i 's|./home-copy.ts|./site-copy.ts|' src/lib/site-copy.test.ts
```

- [ ] **Step 2: Add the new constants**

Append to `src/lib/site-copy.ts`:

```ts
/* ---------------------------------------------------------------- /listings/mine */

/** A state of possibility: you have not posted yet, and posting is easy. */
export const MINE_EMPTY = {
  title: "Nothing posted yet",
  body: "Takes about a minute, and photos do most of the work.",
};

/* ------------------------------------------------------------------------ sign-in */

export const SIGNIN_HEADLINE = "Sign in";

/**
 * Says who the site is for before an account is picked, so a rejection is
 * never a surprise. The domain requirement itself is rendered separately,
 * from ALLOWED_DOMAIN_LABEL, so it cannot drift from the value the callback
 * actually enforces.
 */
export const SIGNIN_INTRO =
  "This is a marketplace for the GMI community, so sign-in is limited to institutional Google accounts.";
```

- [ ] **Step 3: Extend the voice tests to cover them**

In `src/lib/site-copy.test.ts`, update the import to include `MINE_EMPTY`, `SIGNIN_HEADLINE`, `SIGNIN_INTRO`, and extend the `everything` array:

```ts
const everything = [
  HOME_HEADLINE,
  HOME_TAGLINE,
  SEARCH_PLACEHOLDER,
  EMPTY_NOTHING_POSTED.title,
  EMPTY_NOTHING_POSTED.body,
  EMPTY_NO_MATCHES.title,
  EMPTY_NO_MATCHES.body,
  MINE_EMPTY.title,
  MINE_EMPTY.body,
  SIGNIN_HEADLINE,
  SIGNIN_INTRO,
];
```

Then add:

```ts
describe("sign-in copy", () => {
  test("names the audience before an account is chosen", () => {
    // A rejection after picking a Google account is a bad surprise; saying
    // who the site is for first is the whole point of this string.
    assert.match(SIGNIN_INTRO, /GMI community/i);
  });

  test("does not hard-code the domain", () => {
    // ALLOWED_DOMAIN_LABEL is the single source of truth and the signIn
    // callback enforces it. A copy of it here would drift silently.
    assert.ok(!/gmi\.edu\.my/i.test(SIGNIN_INTRO));
  });
});
```

- [ ] **Step 4: Verify**

Run: `npm test`
Expected: 352 + 2 = **354 passing**. Also `npx tsc --noEmit && npx eslint` clean — the rename must leave no stale import.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Widen the copy module from the home page to the whole site

The voice rules policed one page, so any copy added anywhere else
escaped them — which defeats the reason the module exists. Renamed and
extended to cover /listings/mine and sign-in, with a test asserting the
sign-in intro never hard-codes the allowed domain: ALLOWED_DOMAIN_LABEL
is what the signIn callback actually enforces, and a second copy of it
would drift silently.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: One heading treatment, one price treatment

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/signin/page.tsx`
- Modify: `src/app/listings/mine/page.tsx`
- Modify: `src/app/listings/[id]/page.tsx`

**Interfaces:**
- Consumes: `.text-price` from Phase 2.
- Produces: `.text-price-lg` for the detail page.

`globals.css` defines `h1` with a responsive `clamp()` size and size-specific tracking. Sign-in and `/listings/mine` override it with a flat `text-2xl font-semibold`, so headings differ across pages for no reason and stop being responsive. The detail page styles its price as `tabular text-xl font-medium`, a third price treatment.

- [ ] **Step 1: Add the large price class**

In `src/app/globals.css`, immediately after `.text-price`:

```css
/* The detail page's price. Same role as .text-price, one step up, because it
   is the single most important number on the page rather than one of a grid
   of them. */
.text-price-lg {
  font-size: 1.375rem;
  line-height: 1.2;
  letter-spacing: -0.014em;
  font-weight: 600;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
```

`.text-price-lg` must also be added to the display-face selector so it gets Space Grotesk. Change:
```css
h1, h2, h3, .text-display, .text-price {
```
to:
```css
h1, h2, h3, .text-display, .text-price, .text-price-lg {
```

- [ ] **Step 2: Stop overriding the heading scale**

In `src/app/signin/page.tsx`, change:
```tsx
      <h1 className="mb-3 text-2xl font-semibold">Sign in</h1>
```
to:
```tsx
      <h1 className="mb-3">{SIGNIN_HEADLINE}</h1>
```
and add `SIGNIN_HEADLINE` to the `@/lib/site-copy` import.

In `src/app/listings/mine/page.tsx`, change:
```tsx
        <h1 className="text-2xl font-semibold">My listings</h1>
```
to:
```tsx
        <h1>My listings</h1>
```

- [ ] **Step 3: Use the price class on the detail page**

In `src/app/listings/[id]/page.tsx`, change:
```tsx
          <p className="tabular text-xl font-medium">
```
to:
```tsx
          <p className="text-price-lg">
```

- [ ] **Step 4: Check no other page overrides a heading**

```bash
grep -rn "<h1\|<h2\|<h3" src/app src/components --include=*.tsx | grep -E "text-(xs|sm|base|lg|xl|2xl|3xl)|font-(normal|medium|semibold|bold)"
```
Expected: **no matches.** Any that appear are the same bug; fix them the same way. Headings that legitimately need a different size should use `.text-display` or a real heading level, not an ad-hoc override.

- [ ] **Step 5: Verify and look**

Run: `npx tsc --noEmit && npx eslint && npm test && npx next build`

Then `npm run dev` and compare `/`, `/signin`, `/listings/mine` and a listing at 375px and 1280px. Headings should now be visibly the same family of sizes and scale with the viewport rather than sitting at a fixed `text-2xl`.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/app/signin/page.tsx src/app/listings/mine/page.tsx "src/app/listings/[id]/page.tsx"
git commit -m "Stop each page inventing its own headings and prices

globals.css gives h1 a responsive clamp and size-specific tracking, and
two pages overrode it with a flat text-2xl — so headings differed across
the site for no reason and stopped scaling with the viewport. The detail
page had a third price treatment, distinct from the grid's.

Inconsistency like this is most of what reads as amateur, and it is
invisible until you put two pages side by side.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The listing detail page

**Files:**
- Modify: `src/app/listings/[id]/page.tsx`
- Modify: `src/app/listings/[id]/loading.tsx`

- [ ] **Step 1: Read the page and apply the spacing vocabulary**

Open `src/app/listings/[id]/page.tsx`. Replace any margin or padding utility not on the permitted scale (`1, 2, 3, 4, 6, 10, 16`) with the nearest permitted step, applying the grouping rule: title, price and condition belong together and take step `1`–`2` between them; the gap to the description or the seller block takes `6` on a phone and `10` on desktop.

Find the offenders with:
```bash
grep -oE "\b(m|mt|mb|ml|mr|mx|my|p|pt|pb|pl|pr|px|py|gap|gap-x|gap-y)-[0-9.]+" "src/app/listings/[id]/page.tsx" | sort -u
```
Anything outside `1 2 3 4 6 10 16` is a candidate. Leave `0` and fractional values used for optical alignment alone if changing them makes it worse — note any you keep and why in the commit.

- [ ] **Step 2: Update the skeleton to match**

Open `src/app/listings/[id]/loading.tsx` and adjust the skeleton blocks so their heights and gaps mirror what the page now renders — in particular the price block, which is now `.text-price-lg` and taller than it was.

- [ ] **Step 3: Verify and look**

Run: `npx tsc --noEmit && npx eslint && npm test`

Then `npm run dev`, open a listing, and hard-reload with the network throttled to "Slow 3G" so the skeleton is visible for long enough to compare against the loaded page. They should not visibly jump.

- [ ] **Step 4: Commit**

```bash
git add "src/app/listings/[id]/page.tsx" "src/app/listings/[id]/loading.tsx"
git commit -m "Apply the spacing vocabulary to the listing detail page

Uniform spacing is what reads as amateur, so the gaps now follow the
grouping rule: title, price and condition sit close together, and the
distance to the description and seller blocks is larger. The skeleton is
adjusted in the same commit, since the price block grew.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `/listings/mine` and sign-in

**Files:**
- Modify: `src/app/listings/mine/page.tsx`
- Modify: `src/app/listings/mine/loading.tsx`
- Modify: `src/app/signin/page.tsx`

- [ ] **Step 1: Give `/listings/mine` a real empty state**

The current empty state is a bare sentence with an inline link, which looks like an error rather than an invitation, and it does not match the home page's card treatment. Replace:

```tsx
        <p className="text-secondary">
          You haven&rsquo;t posted anything yet.{" "}
          <Link href="/listings/new" className="underline underline-offset-2">
            Post your first listing
          </Link>
          .
        </p>
```

with:

```tsx
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center sm:py-20">
          <p className="text-display">{MINE_EMPTY.title}</p>
          <p className="max-w-sm text-fine text-secondary">{MINE_EMPTY.body}</p>
          <Link href="/listings/new" className="btn btn-primary btn-sm mt-1">
            Post a listing
          </Link>
        </div>
```

Add `MINE_EMPTY` to the `@/lib/site-copy` import. This is the same shape the home page's empty state uses, which is the point.

- [ ] **Step 2: Use the sign-in intro constant**

In `src/app/signin/page.tsx`, replace the opening sentence of the intro paragraph with `{SIGNIN_INTRO}`, keeping the `ALLOWED_DOMAIN_LABEL` sentence that follows it exactly as it is — that string is the requirement the `signIn` callback enforces and must not be paraphrased.

- [ ] **Step 3: Match the `mine` skeleton**

In `src/app/listings/mine/loading.tsx`, confirm the skeleton still resembles the populated list. It does not need to model the empty state — a skeleton is shown while data is loading, and the empty state is a result, not a loading state.

- [ ] **Step 4: Verify and look**

Run: `npx tsc --noEmit && npx eslint && npm test && npx next build`

Then `npm run dev` and check `/listings/mine` **signed in with no listings** and `/signin`, at 375px and 1280px, light and dark.

- [ ] **Step 5: Commit**

```bash
git add src/app/listings/mine/page.tsx src/app/listings/mine/loading.tsx src/app/signin/page.tsx
git commit -m "Give /listings/mine and sign-in the same voice as the home page

The empty state on /listings/mine was a bare sentence with an inline
link, which reads as an error rather than an invitation and looked
nothing like the home page's. It now uses the same card treatment. The
sign-in intro says who the site is for before an account is picked, so a
rejection is never a surprise.

The domain requirement itself is untouched: it renders from
ALLOWED_DOMAIN_LABEL, which is what the signIn callback enforces.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Verify the phase and record it

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Full verification**

```bash
npm test && npm run test:db && npx tsc --noEmit && npx eslint && npx next build
```
Expected: 354 passing, 29 passing, all clean.

- [ ] **Step 2: Side-by-side review**

At 375px and 1280px, light and dark, open `/`, `/signin`, `/listings/mine`, and a listing. Headings should share one scale; prices one treatment; empty states one shape. Nothing overflows horizontally.

- [ ] **Step 3: Check the thread page**

`globals.css` changed, so confirm `/messages/[id]` at 375px still fills the viewport without the whole page scrolling, and the footer is absent (Gotchas #33, #37).

- [ ] **Step 4: Add the Decision Log entry and a gotcha**

Decision Log, before the `2026-08-11` `r2.dev` entry:

```markdown
- **2026-08-16** — **Phase 3 was a consistency pass, and consistency turned out to mean correctness.** Each page had invented its own heading size — two overrode the responsive `h1` clamp with a flat `text-2xl` — its own price styling, and its own tone. That divergence is most of what reads as amateur, and it is invisible until two pages are opened side by side. Copy consolidated from `home-copy.ts` into `site-copy.ts` so the voice rules cover every page rather than only the home page; a test asserts the sign-in intro never hard-codes the allowed domain, since `ALLOWED_DOMAIN_LABEL` is what the `signIn` callback actually enforces. The listing form moved to its own phase: at 537 lines covering the photo picker, conditional fields and validation display, bundling it here would have made a plan nobody could review.
```

Known Gotchas, numbered 47:

```markdown
47. **A Tailwind colour utility built from a token that does not exist emits nothing, and the page still looks fine.** `text-foreground` was used in four places for the project's whole life and generated no CSS at all: the theme defines `--color-content`, so there was no `--color-foreground` for Tailwind to build a utility from. Nothing errors, nothing warns, and the element simply inherits its parent's colour — which looks plausible, which is why it survived. The sign-in page's emphasis on the required email domain was not emphasised, the current breadcrumb was not full strength, and footer links had no hover colour. **The check is to grep the built stylesheet, not the source:** `npx next build && grep -c "text-foo" .next/static/chunks/*.css`. Zero means the class does nothing. Worth running against any colour utility introduced by hand rather than copied from an existing usage.
```

- [ ] **Step 5: Update the test count**

Change `> **Tests:** 352 passing` to `> **Tests:** 354 passing`.

- [ ] **Step 6: Commit, push, open the PR**

```bash
git add AGENTS.md
git commit -m "Record phase 3 of the design revamp

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

git push -u origin feature/design-display-pages
```

PR should cover: the dead class and how it was proved dead, the heading and price divergence, the copy consolidation, and screenshots of the three pages at both widths.

---

## Self-Review

**Spec coverage:** Listing detail → Task 4. `/listings/mine` → Tasks 3 and 5. Sign-in → Tasks 1, 3 and 5. Voice → Task 2, enforced by tests. Skeletons → Tasks 4 and 5. Mobile parity → Tasks 3–6. Legal text untouched → constrained in Global Constraints and Task 5 Step 2. The listing form is explicitly deferred to Phase 3b with the reason stated, rather than silently dropped.

**Placeholder scan:** No TBD/TODO. Task 4 Step 1 is the only step without literal replacement code, because the offending values must be read from the file first; it names the exact command to find them and the exact rule to apply, and requires any exception to be justified in the commit.

**Type consistency:** `MINE_EMPTY`, `SIGNIN_HEADLINE`, `SIGNIN_INTRO` are defined in Task 2 and used in Tasks 3 and 5 with matching `.title`/`.body` shapes. `.text-price-lg` is defined in Task 3 Step 1 and used in Step 3, and is added to the display-face selector in the same step. Test count runs 352 → 354 consistently.
