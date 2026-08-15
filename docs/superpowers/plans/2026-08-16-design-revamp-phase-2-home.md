# Design Revamp — Phase 2: Home

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the home page the agreed voice and a page structure where content outweighs chrome, so four listings read as a small marketplace rather than an empty one.

**Architecture:** Copy moves into `src/lib/home-copy.ts` as exported constants with tests — the pattern `src/lib/legal.ts` already established, and the only way the voice rules become enforceable rather than aspirational. Markup changes are confined to `src/app/page.tsx`, its skeleton in `src/app/loading.tsx`, and one new class in `globals.css`.

**Tech Stack:** Next.js 16 App Router, Tailwind v4, `node:test`. **Zero new dependencies.**

**Spec:** `docs/superpowers/specs/2026-08-16-design-revamp-design.md`

## What Phase 1 already did, so it is not re-done here

Verified by reading the code, not assumed:

- The grid is **already** `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` — the 2/3/4 the spec asks for. **Do not change it.**
- The category chips **already** use `.rail` with `overflow-x-auto` below `sm`, and wrap at `sm:` and up. Mobile is already a scrolling row; the three-row stack is a **desktop-only** artifact.
- `.text-price` is already in the heading `font-family` rule from Phase 1 but has **no size or weight rules yet**. Task 4 defines it.
- Space Grotesk, Inter and the violet accent are live.

## Global Constraints

- **Zero new dependencies.**
- **Voice rules** (from the spec, verbatim):
  1. Personality belongs in states of possibility, never states of friction.
  2. Specific beats generic.
  3. Second person, present tense.
  4. Money, halal, suspension and safety stay sober, always.
  5. No exclamation marks.
- **Spacing uses only** Tailwind steps `1, 2, 3, 4, 6, 10, 16` (documented in `globals.css`). The rule that matters: the gap between two related things must be smaller than the gap to the next group.
- **`loading.tsx` must keep matching the page.** A skeleton that flashes the wrong shape is worse than none, and a Neon cold start is 7.3s so it is seen often.
- **Reviewed at 375px and 1280px, light and dark**, before the phase is called done.
- **`npm test` and `npm run test:db` stay green**, plus `tsc --noEmit`, `eslint`, `next build`.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/home-copy.ts` (create) | The home page's marketing strings as constants. No JSX, no I/O. |
| `src/lib/home-copy.test.ts` (create) | Enforces the voice rules mechanically. |
| `src/app/page.tsx` (modify) | Headline band, search placeholder, empty states, price prominence, desktop rail. |
| `src/app/loading.tsx` (modify) | Skeleton kept in step with the layout. |
| `src/app/globals.css` (modify) | `.text-price` sizing, one rule. |
| `AGENTS.md` (modify) | Decision Log. |

---

### Task 1: Copy as testable constants

**Files:**
- Create: `src/lib/home-copy.ts`
- Create: `src/lib/home-copy.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `HOME_HEADLINE: string`
  - `HOME_TAGLINE: string`
  - `SEARCH_PLACEHOLDER: string`
  - `EMPTY_NOTHING_POSTED: { title: string; body: string }`
  - `EMPTY_NO_MATCHES: { title: string; body: string }`

Copy lives in a module rather than inline in JSX for the same reason `AFFILIATION_DISCLAIMER` does: a string with a rule attached to it needs somewhere a test can reach. "No exclamation marks" and "friction states stay plain" are otherwise aspirations nobody checks.

- [ ] **Step 1: Write the failing test**

Create `src/lib/home-copy.test.ts`:

```ts
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_NO_MATCHES,
  EMPTY_NOTHING_POSTED,
  HOME_HEADLINE,
  HOME_TAGLINE,
  SEARCH_PLACEHOLDER,
} from "./home-copy.ts";

const everything = [
  HOME_HEADLINE,
  HOME_TAGLINE,
  SEARCH_PLACEHOLDER,
  EMPTY_NOTHING_POSTED.title,
  EMPTY_NOTHING_POSTED.body,
  EMPTY_NO_MATCHES.title,
  EMPTY_NO_MATCHES.body,
];

describe("voice rules", () => {
  test("nothing shouts", () => {
    // Cheap enthusiasm is one of the clearest AI tells.
    for (const line of everything) {
      assert.ok(!line.includes("!"), `exclamation mark in: ${line}`);
    }
  });

  test("no string is empty or left as a placeholder", () => {
    for (const line of everything) {
      assert.ok(line.trim().length > 0);
      assert.ok(!/TODO|TBD|Lorem/i.test(line), `placeholder text in: ${line}`);
    }
  });
});

describe("the pitch", () => {
  test("the tagline names the thing the site is an alternative to", () => {
    // The product's whole argument. If this sentence stops mentioning the
    // group chat, the home page has stopped making the case.
    assert.match(HOME_TAGLINE, /group chat/i);
  });

  test("the headline says what you can do, not what the site is", () => {
    assert.match(HOME_HEADLINE, /buy/i);
    assert.match(HOME_HEADLINE, /sell/i);
    assert.match(HOME_HEADLINE, /rent/i);
  });
});

describe("the search placeholder", () => {
  test("suggests real things before the joke", () => {
    // Two real items first so it reads as a hint rather than a gag, and so
    // the joke still lands when it truncates on a narrow phone.
    assert.match(SEARCH_PLACEHOLDER, /^Books/);
    assert.match(SEARCH_PLACEHOLDER, /time machine/i);
  });

  test("stays short enough to survive a phone", () => {
    assert.ok(
      SEARCH_PLACEHOLDER.length <= 40,
      `placeholder is ${SEARCH_PLACEHOLDER.length} characters`,
    );
  });

  test("jokes about the impossible, never the prohibited", () => {
    // A gag about a banned item would undercut the Acceptable Use Policy.
    const forbidden = /exam|assignment|answer|weapon|drug|alcohol|vape/i;
    assert.ok(!forbidden.test(SEARCH_PLACEHOLDER));
  });
});

describe("empty states", () => {
  test("the two states say different things", () => {
    // "Nothing posted yet" and "nothing matches your filter" are different
    // problems and the same sentence for both helps neither.
    assert.notEqual(EMPTY_NOTHING_POSTED.body, EMPTY_NO_MATCHES.body);
  });

  test("possibility gets personality", () => {
    assert.match(EMPTY_NOTHING_POSTED.body, /group chat/i);
  });

  test("friction stays plain", () => {
    // Somebody whose search just failed is not the audience for a joke.
    assert.ok(!/group chat/i.test(EMPTY_NO_MATCHES.body));
    assert.match(EMPTY_NO_MATCHES.body, /broader|clear/i);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './home-copy.ts'`.

- [ ] **Step 3: Write the module**

Create `src/lib/home-copy.ts`:

```ts
/**
 * The home page's marketing copy.
 *
 * Kept here rather than inline in JSX for the same reason
 * `AFFILIATION_DISCLAIMER` is in `legal.ts`: these strings have rules
 * attached — no shouting, personality only in states of possibility, jokes
 * about the impossible rather than the prohibited — and a rule with no test
 * beside it is an aspiration.
 *
 * The voice belongs to someone who got tired of listings being buried in the
 * GMI WhatsApp and Telegram groups and built somewhere for them to live.
 */

export const HOME_HEADLINE = "Buy, sell and rent around GMI.";

/** The product's entire argument, in six words. */
export const HOME_TAGLINE = "Without it buried in a group chat.";

/**
 * Two real items, then one impossible one. Real first so it reads as a hint
 * rather than a gag, and short so the joke survives truncation on a phone.
 * Deliberately absurd rather than illicit — a joke about a banned item would
 * undercut the Acceptable Use Policy.
 */
export const SEARCH_PLACEHOLDER = "Books, clown nose, time machine…";

/** A state of possibility, so it gets the point of view. */
export const EMPTY_NOTHING_POSTED = {
  title: "Nothing posted yet",
  body: "Be first — it will still be here next week, which is more than the group chat can manage.",
};

/** A state of friction. Plain and useful; nobody wants wit here. */
export const EMPTY_NO_MATCHES = {
  title: "No matches",
  body: "Nothing matches those filters yet. Try a broader category, or clear the search.",
};
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS, 342 + 9 = **351 tests**.

- [ ] **Step 5: Type-check, lint, commit**

Run: `npx tsc --noEmit && npx eslint`

```bash
git add src/lib/home-copy.ts src/lib/home-copy.test.ts
git commit -m "Move the home page's copy somewhere a test can reach it

The voice rules — no shouting, personality only in states of
possibility, jokes about the impossible rather than the prohibited —
were aspirations while the strings lived inline in JSX. As constants
they are enforceable, which is why AFFILIATION_DISCLAIMER lives in
legal.ts rather than in a component.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The headline band

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/loading.tsx`

**Interfaces:**
- Consumes: `HOME_HEADLINE`, `HOME_TAGLINE` from Task 1.
- Produces: nothing later tasks depend on.

The current band is a heading plus a three-line explanatory paragraph, and it pushes listings down for prose nobody reads twice. The pitch replaces the explanation; the sign-in prompt survives in one short line because it is genuinely useful to a signed-out visitor.

- [ ] **Step 1: Add the import**

In `src/app/page.tsx`, alongside the other `@/lib` imports:

```ts
import { HOME_HEADLINE, HOME_TAGLINE, SEARCH_PLACEHOLDER, EMPTY_NOTHING_POSTED, EMPTY_NO_MATCHES } from "@/lib/home-copy";
```

- [ ] **Step 2: Replace the headline section**

Replace the whole `<section className="mb-8">…</section>` block with:

```tsx
      <section className="mb-6 sm:mb-10">
        <h1>{HOME_HEADLINE}</h1>
        <p className="mt-1 text-secondary">{HOME_TAGLINE}</p>
        {!session?.user && (
          <p className="mt-3 text-fine text-tertiary">
            Anyone can browse.{" "}
            <Link
              href="/signin"
              className="font-medium text-accent underline underline-offset-4"
            >
              Sign in with your {ALLOWED_DOMAIN_LABEL} account
            </Link>{" "}
            to post or message a seller.
          </p>
        )}
      </section>
```

Note the spacing: `mt-1` between headline and tagline (they are one thought), `mt-3` before the sign-in line (a separate one), `mb-6`/`sm:mb-10` to the next section. That is the grouping rule from `globals.css` — related things closer than unrelated ones.

- [ ] **Step 3: Match the skeleton**

In `src/app/loading.tsx`, replace:

```tsx
        <Skeleton className="mb-3 h-9 w-4/5 max-w-md rounded" />
        <Skeleton className="mb-8 h-4 w-full max-w-lg rounded" />
```

with:

```tsx
        <Skeleton className="mb-1 h-9 w-4/5 max-w-md rounded" />
        <Skeleton className="mb-6 h-4 w-3/5 max-w-xs rounded sm:mb-10" />
```

The tagline is one short line now, not a full-width paragraph, and the skeleton has to agree or the page visibly reflows when it loads.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx eslint && npm test`
Expected: clean, 351 passing.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/loading.tsx
git commit -m "Lead with the pitch instead of an explanation

The band was a heading plus three lines of prose explaining what a
marketplace is, which pushed the listings down the page for something
nobody reads twice. The tagline makes the product's argument in six
words instead. The sign-in prompt survives, shorter, because it is
genuinely useful to a signed-out visitor.

The skeleton is updated in the same commit — the tagline is now one
short line rather than a full-width paragraph, and a skeleton that
flashes the wrong shape is worse than none on a 7.3s cold start.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Placeholder and empty states

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `SEARCH_PLACEHOLDER`, `EMPTY_NOTHING_POSTED`, `EMPTY_NO_MATCHES` from Task 1.
- Produces: nothing.

- [ ] **Step 1: Use the placeholder constant**

Replace:
```tsx
          placeholder="Search listings…"
```
with:
```tsx
          placeholder={SEARCH_PLACEHOLDER}
```

- [ ] **Step 2: Rewrite the empty state**

Replace the empty-state block:

```tsx
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <p className="font-medium">No listings found</p>
          <p className="max-w-sm text-fine text-secondary">
            {filtered
              ? "Nothing matches those filters yet. Try a broader category, or clear the search."
              : "Nothing has been posted yet. Be the first."}
          </p>
```

with:

```tsx
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center sm:py-20">
          <p className="text-display">
            {filtered ? EMPTY_NO_MATCHES.title : EMPTY_NOTHING_POSTED.title}
          </p>
          <p className="max-w-sm text-fine text-secondary">
            {filtered ? EMPTY_NO_MATCHES.body : EMPTY_NOTHING_POSTED.body}
          </p>
```

Leave the two buttons below it exactly as they are. `.text-display` gives the title the display face and real size, so an empty board looks deliberate rather than like a failed load — and the taller padding is what stops it reading as a thin grey strip.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint && npm test`
Expected: clean, 351 passing.

- [ ] **Step 4: See both states**

Run `npm run dev`. Visit:
- `http://localhost:3000/?q=zzzznothing` → the **friction** state: plain, offers "Clear filters".
- Temporarily filter to a category with no listings for the same effect.

To see the *unfiltered* empty state without deleting data, read it from the code rather than emptying the database — it is the `filtered === false` branch.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "Give the empty states a voice, and the search box a joke

The unfiltered empty state now makes the site's argument — it will still
be here next week, unlike the group chat — while the filtered one stays
deliberately plain, because somebody whose search just failed is not the
audience for wit. The placeholder suggests two real things before an
impossible one: absurd rather than prohibited, so it cannot undercut the
Acceptable Use Policy.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Give the price its weight, and calm the desktop chips

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: the `.text-price` selector already added to the heading `font-family` rule in Phase 1.
- Produces: `.text-price` as a usable class.

Two changes with one theme: content should outweigh chrome. The price is currently `text-fine text-secondary` — small and grey — when it is the most-scanned element on a marketplace card. The category chips wrap to three rows on desktop, which is ~90px of controls above the fold.

- [ ] **Step 1: Define `.text-price`**

In `src/app/globals.css`, immediately after the `small, .text-fine` rule, add:

```css
/* The most-scanned element on a listing card. It was `text-fine
   text-secondary` — smaller and greyer than the title — which is backwards
   for a marketplace. Display face, full-strength text, tabular so a column
   of prices does not jitter. */
.text-price {
  font-size: 0.9375rem;
  line-height: 1.3;
  letter-spacing: -0.006em;
  font-weight: 600;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 2: Use it on the card**

In `src/app/page.tsx`, replace:
```tsx
                  <p className="tabular text-fine text-secondary">
```
with:
```tsx
                  <p className="text-price">
```

(`.text-price` sets `tabular-nums` itself, so the `tabular` class is redundant.)

- [ ] **Step 3: Keep the category chips to one row at every width**

Replace:
```tsx
      <div className="rail -mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
```
with:
```tsx
      {/* One scrolling row at every width. Wrapping seventeen chips put three
          rows of controls above the fold on desktop, which is most of why a
          page with four listings read as empty — chrome outweighing content.
          `.scroll-edge` fades the right edge so it is visibly scrollable. */}
      <div className="rail scroll-edge -mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:mb-10 sm:px-0">
        <div className="flex w-max gap-2">
```

- [ ] **Step 4: Match the skeleton's chip row**

In `src/app/loading.tsx`, replace:
```tsx
        <div className="mb-8 flex gap-2 overflow-hidden">
```
with:
```tsx
        <div className="mb-6 flex gap-2 overflow-hidden sm:mb-10">
```

- [ ] **Step 5: Confirm `.scroll-edge` exists and does what the comment claims**

Run:
```bash
sed -n '/^\.scroll-edge/,/^}/p' src/app/globals.css
```
Expected: a rule producing a fade or mask on the right edge. **If it does not exist or does something else, drop `scroll-edge` from the class list** rather than shipping a comment that lies — and say so in the commit.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx eslint && npm test && npx next build`
Expected: all clean, 351 passing.

- [ ] **Step 7: Look at it**

Run `npm run dev` and check `http://localhost:3000` at **1280px** and **375px**, light and dark:
- Categories are one scrolling row at both widths.
- The first listing is visible much closer to the top on desktop.
- Prices read as prominent, in Space Grotesk, not grey.
- The rail still scrolls with a trackpad and by touch.

- [ ] **Step 8: Commit**

```bash
git add src/app/globals.css src/app/page.tsx src/app/loading.tsx
git commit -m "Let content outweigh chrome on the home page

Two changes with one theme. The price was smaller and greyer than the
title, which is backwards for a marketplace, so it gets the display face
and full-strength text. And the category chips wrapped to three rows on
desktop — around ninety pixels of controls above the fold — so they are
now one scrolling row at every width, matching what a phone already did.

Between them, the first listing arrives far higher up the page, which is
most of why four listings read as an empty site rather than a small one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Verify the phase and record it

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Full verification**

Run:
```bash
npm test && npm run test:db && npx tsc --noEmit && npx eslint && npx next build
```
Expected: 351 passing, 29 passing, all clean.

- [ ] **Step 2: Review at both widths, both schemes**

At 375px and 1280px, in light and dark, confirm: the headline band is two tight lines plus one optional sign-in line; categories are a single scrolling row; the grid is 2 columns on the phone and 4 on desktop; prices are prominent; nothing overflows horizontally.

- [ ] **Step 3: Check the conversation thread is undisturbed**

`globals.css` changed, so open `/messages/[id]` at 375px and confirm it still fills the viewport without the whole page scrolling and the footer is absent (Gotchas #33, #37).

- [ ] **Step 4: Add the Decision Log entry**

In `AGENTS.md`, before the `- **2026-08-11** — Resolved the \`r2.dev\`` entry:

```markdown
- **2026-08-16** — **Home page revoiced and restructured; emptiness treated as a layout problem.** The site felt barren with four listings, and the cause was measurable rather than aesthetic: a headline band of explanatory prose, a search row, a type-filter row and seventeen category chips wrapping to three rows put roughly 450px of chrome above the first listing on desktop. Categories are now one scrolling row at every width — which is what the phone already did — and the explanation is replaced by the product's actual argument, "Without it buried in a group chat." The price also moved from `text-fine text-secondary` to its own `.text-price` class: it was rendering smaller and greyer than the title, which is backwards for a marketplace. Copy moved to `src/lib/home-copy.ts` with tests, following the `legal.ts` precedent — the voice rules (no shouting, personality only in states of possibility, jokes about the impossible rather than the prohibited) are only real if something checks them.
```

- [ ] **Step 5: Update the test count**

Change `> **Tests:** 342 passing` to `> **Tests:** 351 passing`.

- [ ] **Step 6: Commit, push, open the PR**

```bash
git add AGENTS.md
git commit -m "Record phase 2 of the design revamp

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

git push -u origin feature/design-home
```

PR should cover: the measured chrome-versus-content problem, the copy module and why it is testable, and before/after screenshots at 375px and 1280px.

---

## Self-Review

**Spec coverage:** Headline and tagline → Task 2. Search placeholder → Tasks 1 and 3. Empty states → Tasks 1 and 3. Voice rules → Task 1, enforced by tests. Density/structure → Task 4. Skeletons kept in step → Tasks 2 and 4. Mobile parity → Tasks 4 and 5. Grid columns and the mobile rail needed no work and are documented as such at the top, so nobody "fixes" them.

**Placeholder scan:** No TBD/TODO. Every code step carries real code. Task 4 Step 5 states explicitly what to do if `.scroll-edge` turns out not to exist, rather than assuming.

**Type consistency:** `HOME_HEADLINE`, `HOME_TAGLINE`, `SEARCH_PLACEHOLDER`, `EMPTY_NOTHING_POSTED`, `EMPTY_NO_MATCHES` are used in Tasks 2–3 exactly as defined in Task 1, with `.title`/`.body` matching the object shape. Test counts run 342 → 351 consistently.
