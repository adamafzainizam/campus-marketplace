# Overhaul Phase 7: Admin and Legal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the token pass on `/admin/*` and `/legal/*`. An audit found both already on the notice-board classes from Phase 1 (legal prose is Archivo at 65ch and 1.6 line height; admin uses `.card`, `.chip`, `.btn`, `.field`, `.notice`), leaving five class edits.

**Spec:** `docs/superpowers/specs/2026-09-27-notice-board-overhaul-design.md`, section 2 "Phase 7: Admin and legal (tokens only)": no layout change; **no legal wording changes at all, including em-dashes** (rule 11.F outranks 9.G). Base: `feature/overhaul-6-messages` (PR #56).

## Global Constraints

- Branch `feature/overhaul-7-admin-legal`. **Never stage `README.md` or `docs/case-study.md`.**
- Class edits only. **No text inside `src/app/legal/**` changes**, not even an em-dash; `src/lib/legal.ts` is not touched.
- Tokens only; 1.5px borders; 3px radius.
- Four checks green; commit message ends with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

### Task 1: Admin and legal tokens

- [ ] `src/app/admin/reports/[id]/RevealMessage.tsx`, the message `<li>` class: `rounded-lg border p-3 text-sm` becomes `rounded border-[1.5px] p-3 text-sm`; the reported branch `border-[var(--danger)] bg-[var(--danger-subtle)]` becomes `border-danger bg-danger-subtle` (the theme maps both tokens to utilities); the other branch stays `border-line bg-surface-sunken`.
- [ ] `src/app/admin/reports/[id]/ResolveReport.tsx` and `src/app/admin/reports/[id]/page.tsx`: `mt-6 border-t border-line pt-4` becomes `mt-6 border-t-[1.5px] border-line pt-4` (one occurrence each).
- [ ] `src/app/legal/LegalDocumentPage.tsx`: the `<hr>`'s `border-t` becomes `border-t-[1.5px]`. Nothing else in the file.
- [ ] Verify: four checks; grep the compiled CSS (`ls .next/static/chunks/*.css`) for `border-danger` and `bg-danger-subtle`; `git diff --stat` shows exactly four files; `git diff src/app/legal` changes only that one class. Commit: "Admin and legal on the notice-board tokens".
