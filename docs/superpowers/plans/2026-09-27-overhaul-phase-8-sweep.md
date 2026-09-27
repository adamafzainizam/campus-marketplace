# Overhaul Phase 8: Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every em-dash and en-dash from visible UI strings outside `/legal`, guard it with a test, close the two items parked for this phase, and run the taste skill's pre-flight checklist.

**Spec:** `docs/superpowers/specs/2026-09-27-notice-board-overhaul-design.md`, section 2 "Phase 8: Sweep". Base: `feature/overhaul-7-admin-legal` (PR #57).

## Global Constraints

- Branch `feature/overhaul-8-sweep`. **Never stage `README.md` or `docs/case-study.md`.**
- **Nothing under `src/app/legal/` or in `src/lib/legal.ts` changes** (legal em-dashes are kept by decision; see spec section 3).
- Code comments are not UI and keep their dashes.
- A rewrite changes punctuation only (full stop, comma, colon); meaning and all other words stay. Where a test asserts the exact old string, update the test to the new string.
- Four checks green; commit messages end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: The em-dash sweep and its guard

Replace these, exactly (the `—` may be written as `&mdash;` in JSX; the replacement for an entity is the plain text shown):

| File | Old | New |
|---|---|---|
| `src/lib/halal.ts` (~54) | `Only pick this if you are sure — including the ingredients and how it was prepared.` | `Only pick this if you are sure, including the ingredients and how it was prepared.` |
| `src/lib/halal.ts` (~89, `HALAL_NOT_VERIFIED`) | `…checked by anyone — if it matters to you, ask them directly before buying.` | `…checked by anyone. If it matters to you, ask them directly before buying.` |
| `src/lib/halal.ts` (~113) | `Say whether this food is halal — pick one of the options.` | `Say whether this food is halal: pick one of the options.` |
| `src/components/ReportButton.tsx` (~48) | `Thanks — this has been sent to a moderator.` | `Thanks. This has been sent to a moderator.` |
| `src/components/ReportButton.tsx` (~155) | `…GMI security first &mdash; nobody is watching this around the clock.` | `…GMI security first. Nobody is watching this around the clock.` |
| `src/lib/category-order.ts` (~83) | `…characters — it's a category, not a description.` | `…characters. It's a category, not a description.` |
| `src/lib/category-order.ts` (~103) | `` `Other — ${detail}` `` | `` `Other: ${detail}` `` |
| `src/lib/site-copy.ts` (`INBOX_EMPTY.body`) | `…it lands here — not buried under forty messages.` | `…it lands here, not buried under forty messages.` |
| `src/lib/upload-to-storage.ts` (~66) | `Your connection may be slow — try again, or use a smaller image.` | `Your connection may be slow, so try again or use a smaller image.` |
| `src/lib/report-rules.ts` (~95) | `Anything else — please describe it below.` | `Anything else. Please describe it below.` |
| `src/app/admin/reports/page.tsx` (~50) | `Oldest first &mdash; the longest-unanswered…` | `Oldest first: the longest-unanswered…` |
| `src/app/admin/reports/[id]/page.tsx` (~93) | `The report is kept anyway &mdash; it…` | `The report is kept anyway, because it…` if that reads as the same meaning; otherwise a full stop and a capital. Report which. |
| `src/app/admin/reports/[id]/RevealMessage.tsx` (~72) | `…either side are read &mdash; never the whole conversation.` | `…either side are read, never the whole conversation.` |
| `src/app/admin/reports/[id]/ResolveReport.tsx` (~47, placeholder) | `Removed the listing — it was an exam paper.` | `Removed the listing: it was an exam paper.` |
| `src/app/admin/reports/[id]/ResolveReport.tsx` (~64, ~72, buttons) | `Close — action taken`, `Close — nothing needed` | `Close: action taken`, `Close: nothing needed` |

- [ ] **Step 1:** Add to `src/lib/site-copy.test.ts` a test that no exported string, including nested object fields, contains `—` or `–`. It should iterate `Object.values` of the module namespace (`import * as copy from "./site-copy.ts"`) recursively, so a new export is covered automatically. Run it and confirm it fails on `INBOX_EMPTY`.
- [ ] **Step 2:** Make every replacement in the table. Update any test asserting an old string (likely `category-order.test.ts` for "Other — …", and perhaps `halal.test.ts`, `report-rules.test.ts`).
- [ ] **Step 3:** Add the same no-dash assertion for the user-visible strings in `halal.ts` (`HALAL_NOT_VERIFIED` plus every `halalOptionLabel`, `halalOptionHint` and `halalDisplayLabel` value) and in `report-rules.ts` (every `reportReasonLabel` and `reportReasonHint`), each in its existing test file.
- [ ] **Step 4:** Final sweep: `grep -rnE "—|–|&mdash;|&ndash;" src --include=*.ts --include=*.tsx | grep -v "^src/app/legal/\|^src/generated/\|\.test\.ts"`. Every remaining hit must be inside a code comment; list any that are not. Commit first, then mutation-check (put a `—` back into `INBOX_EMPTY.body`, confirm the new test fails, then `git checkout` the file; Gotcha #50). Commit: "Sweep em-dashes out of UI copy, with a guard".

### Task 2: The two parked items

- [ ] **Forced colours.** In forced-colors mode a selected `.chip` or `.segment` looks the same as an unselected one, because the highlighter fill is dropped. In `src/app/globals.css`, inside `@layer components`, after the `.segment-selected` rule:

```css
  /* Forced colours drop the highlighter fill, so the selected chip or
     segment would look like the rest. An underline survives. */
  @media (forced-colors: active) {
    .chip-selected,
    .segment-selected {
      text-decoration: underline 2px;
      text-underline-offset: 0.2em;
    }
  }
```

- [ ] **Remove the unused one-line meta layout.** Every `ListingMeta` caller passes `layout="split"`. Remove the `layout` prop and the `line` branch from `src/components/ListingMeta.tsx`, so split is the only behaviour; drop `layout="split"` from both callers (`src/components/ListingCard.tsx`, `src/app/listings/[id]/page.tsx`); update the doc comment. Keep `listingMetaParts` in `listing-labels.ts`, since the `cardMetaParts` test ties the two together. Run the four checks and commit: "Forced-colours selected state; ListingMeta is split-only".

## After (Opus)

The taste skill's Section 14 pre-flight checklist goes in the PR, marking N/A items. Forced-scheme screenshots of every signed-out page at 1280 and 375. AGENTS.md: the overhaul is complete pending merges and the builder's walks.
