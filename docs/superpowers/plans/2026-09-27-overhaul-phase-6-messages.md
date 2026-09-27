# Overhaul Phase 6: Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the inbox and the conversation thread onto the notice-board tokens without touching the thread's structure.

**Architecture:** Class edits only, plus one unlayered CSS rule. The thread's DOM, its flex/height classes and the `.thread-viewport` marker are not edited (Gotchas #33, #37); only colour, border and radius classes change there.

**Spec:** `docs/superpowers/specs/2026-09-27-notice-board-overhaul-design.md`, section 2 "Phase 6: Messages (tokens only)": *"Inbox rows: `.card` language, unread badge `--highlight`. Thread: own bubbles `--highlight` fill with `--on-highlight` text; the other party's `--surface-raised` with 1.5px border. The thread's DOM structure, flex/height classes and `.thread-viewport` marker are not edited. The h1 size deviation documented there stays."* Base: `feature/overhaul-5-forms` (PR #55).

## Global Constraints

- Branch `feature/overhaul-6-messages` (checked out). Never commit on `main`. **Never stage `README.md` or `docs/case-study.md`.**
- Do not add, remove or reorder elements in `src/app/messages/[id]/page.tsx`, `MessageThread.tsx` or `src/app/messages/[id]/loading.tsx`; do not change any `flex`, `min-h-0`, `flex-1`, `overflow-*`, `h-*` or `thread-viewport` class there. Colour, border, radius and opacity classes may change.
- Tokens only; 1.5px borders; radius 3px (`rounded`) or 2px (`rounded-sm`).
- Focus rings: Tailwind `focus-visible:outline-*` utilities never apply (Gotcha #53). Use an unlayered rule placed next to the global `:focus-visible` rule in `globals.css`.
- No copy changes, except no em-dash may be added.
- Four checks green (`npm test`, `npx tsc --noEmit`, `npx eslint .`, `npx next build`); grep new CSS in `ls .next/static/chunks/*.css`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Inbox and thread tokens

**Files:** `src/app/globals.css`, `src/app/messages/page.tsx`, `src/app/messages/loading.tsx`, `src/app/messages/[id]/page.tsx`, `src/app/messages/[id]/MessageThread.tsx`, `src/app/messages/[id]/loading.tsx`

- [ ] **Step 1: Inbox rows** (`src/app/messages/page.tsx`)
  - The list: `card flex flex-col divide-y divide-line overflow-hidden` becomes `card flex flex-col divide-y-[1.5px] divide-line overflow-hidden`.
  - Each row link gets the class `inbox-row` added, plus `transition-colors hover:bg-surface-sunken` (background-colour feedback only). Keep its layout classes.
  - The thumbnail wrapper: `rounded-lg border border-line` becomes `rounded-sm border-[1.5px] border-line`.
  - The empty state: `<p className="text-display">` becomes `<h2 className="text-display">` (same children), as on browse and `/listings/mine`.
- [ ] **Step 2: Inbox row focus ring** (`src/app/globals.css`). Each row link fills a card with `overflow-hidden`, so the global ring (drawn 2px outside) is clipped. Directly after the `.card-owner` rules that follow the global `:focus-visible` (unlayered, outside any `@layer`), add:

```css
/* Inbox rows fill an overflow-hidden card, so their ring is drawn inside
   the row instead of being clipped. Unlayered for the same reason as the
   rules above. */
.inbox-row:focus-visible { outline-offset: -3px; }
```

- [ ] **Step 3: Thread** (`MessageThread.tsx`, bubble `className` only)
  - The bubble's `rounded-lg` becomes `rounded`.
  - Own bubble: `bg-highlight text-on-highlight` gains `border-[1.5px] border-transparent`, so both kinds of bubble are the same size.
  - The other party's bubble: `bg-surface-sunken border border-line` becomes `bg-surface-raised border-[1.5px] border-line`.
  - The composer form's `border-t border-line` becomes `border-t-[1.5px] border-line`.
- [ ] **Step 4: Thread header** (`src/app/messages/[id]/page.tsx`): `border-b border-line` becomes `border-b-[1.5px] border-line`. Nothing else changes; the `text-lg` h1 deviation stays.
- [ ] **Step 5: Skeletons.** In `src/app/messages/loading.tsx`, `divide-y` becomes `divide-y-[1.5px]` and the thumbnail's `rounded-lg` becomes `rounded-sm`. In `src/app/messages/[id]/loading.tsx`, the header's `border-b` becomes `border-b-[1.5px]`. Change no other class there.
- [ ] **Step 6: Verify and commit.** Run the four checks; grep the compiled CSS for `.inbox-row:focus-visible` and confirm it sits outside every `@layer` block. Run `git diff` on the three thread files and confirm that only colour, border and radius tokens changed. Commit the six files: "Messages on the notice-board tokens".

## After (Opus)

Review, AGENTS.md, and a PR stacked on #55. The inbox and thread need a session, so they go to the builder's walk, which must include the thread's height with the mobile menu open (the Phase 2 carry-over).
