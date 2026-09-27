# Overhaul Phase 5: Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the forms in the notice-board language without changing their structure: a visible keyboard focus ring on the listing-type chips, photo-picker thumbnails framed like the gallery's, and the sign-in page as one centred card.

**Architecture:** The listing form and photo picker already use the shared classes (`.field`, `.label`, `.chip`, `.btn`, `.dropzone`), so Phase 1 restyled them. This phase fixes what the shared classes cannot: one CSS rule for chips that wrap a visually hidden radio, three class edits, and the sign-in layout. No new dependencies, no copy changes except the three em-dashes named below.

**Spec:** `docs/superpowers/specs/2026-09-27-notice-board-overhaul-design.md`, section 2 "Phase 5: Forms (tokens and components only)". Base: `feature/overhaul-4-detail` (PR #54, stacked on #53).

## Global Constraints

- Branch: `feature/overhaul-5-forms` (checked out, stacked on `feature/overhaul-4-detail`). Never commit on `main`.
- **Never stage `README.md` or `docs/case-study.md`.** `git add` explicit paths only.
- Form structure is fixed: field names, order, conditional logic and validation messages do not change.
- Colour only through tokens. Yellow never text or a hairline on a light surface.
- Radius 3px (`rounded`), 2px (`rounded-sm`). Borders 1.5px. No pills.
- Focus rings: a Tailwind `focus-visible:outline-*` utility never applies here, because the global `:focus-visible` rule is unlayered (Gotcha #53). A control whose focusable element is visually hidden gets its ring from a `:has(input:focus-visible)` rule on the visible wrapper, as `.dropzone` already does.
- No em-dash or en-dash in any visible string you touch.
- Every task ends with `npm test`, `npx tsc --noEmit`, `npx eslint .`, `npx next build` green; grep new CSS in the compiled output at the path `ls .next/static/chunks/*.css` prints (Gotcha #47).
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`

---

### Task 1: Listing form and photo picker

**Files:** `src/app/globals.css`, `src/app/listings/new/ListingForm.tsx`, `src/components/PhotoPicker.tsx`

- [ ] **Step 1: Chip-radio focus ring.** The listing-type chips are `<label className="chip …">` wrapping an `sr-only` radio, so the global ring lands on an invisible input and a keyboard user sees nothing (parked from Phase 1). In `globals.css`, inside `@layer components`, directly after the `.chip-selected` rule, add:

```css
  /* A chip that wraps a visually hidden radio: the ring goes on the chip,
     because the focused input is invisible. Same pattern as .dropzone. */
  .chip:has(input:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
```

- [ ] **Step 2: ListingForm edits.**
  - Line ~269: the chip's className template adds `border-line` for the unselected state; `.chip` already sets that border, so reduce it to `` className={`chip cursor-pointer${type === value ? " chip-selected" : ""}`} ``.
  - Line ~352: the link inside the academic-integrity notice uses `underline underline-offset-2`; use the shared `link` class instead.
  - Upload progress bar (line ~511): the track `h-1.5 w-full overflow-hidden rounded-sm bg-surface-sunken` becomes `h-2 w-full overflow-hidden rounded-sm border-[1.5px] border-line bg-surface-sunken`, so it reads as a printed bar in the card language. The fill stays `bg-action`.

- [ ] **Step 3: PhotoPicker edits.**
  - Thumbnail `<img>` (line ~198): `rounded-lg border border-line … shadow-sm` becomes `rounded-sm border-[1.5px] border-line` (framed like the gallery's thumbnails; keep `aspect-square w-full object-cover`).
  - The hint (line ~234) "The first photo is the cover — it is the one shown on the browse page and in messages." becomes "The first photo is the cover. It is the one shown on the browse page and in messages."

- [ ] **Step 4: Verify and commit.** Run the four checks; grep the compiled CSS for `.chip:has(`. Confirm no other `rounded-lg`, `shadow-sm` on images, or `underline-offset` remains in these two files. Commit the three files: "Forms: chip focus ring, framed thumbnails, printed progress bar".

---

### Task 2: Sign-in as one centred card

**Files:** `src/app/signin/page.tsx`

Spec: *"Sign-in: one centred `.card` (centring is right for an auth page), headline, intro, the domain requirement rendered from `ALLOWED_DOMAIN_LABEL` as now, the Google button as `btn-primary`."*

- [ ] **Step 1: Layout.** Keep the page wrapper and the `Breadcrumbs` above the card. Wrap everything from the `<h1>` through the consent paragraph in `<div className="card p-6 sm:p-8">`. The page wrapper stays `max-w-lg`. Inside the card:
  - `<h1 className="mb-3">` stays.
  - The intro paragraph keeps its content and `ALLOWED_DOMAIN_LABEL` rendering. Replace its one em-dash: "Google account &mdash; including student addresses like X." becomes "Google account, including student addresses like X."
  - Error notice, form and consent paragraph unchanged.
  The last paragraph ("You can browse listings without signing in…") moves **below the card**, `mt-6 text-center text-sm text-secondary`, since it is advice about the page rather than part of signing in. Text inside the card stays left-aligned, which reads better for a paragraph of rules; only the card itself is centred, by the `mx-auto` wrapper.

- [ ] **Step 2: Verify and commit.** Four checks. Confirm `SIGNIN_HEADLINE`, `SIGNIN_INTRO`, `ALLOWED_DOMAIN_LABEL`, `subdomainLabel("student")` and both legal links still render. Commit: "Sign-in as one centred card".

---

## After the tasks (Opus)

Screenshot `/signin` in both themes at 1280 and 375 (and `/signin?error=AccessDenied`). The listing form needs a session, so it goes to the builder's walk. AGENTS.md update, final review, PR stacked on #54.
