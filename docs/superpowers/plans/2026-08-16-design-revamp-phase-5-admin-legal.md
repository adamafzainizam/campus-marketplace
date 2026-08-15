# Design Revamp — Phase 5: Admin and legal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.

**Goal:** Finish the revamp by bringing admin and legal onto the spacing scale, and prove no legal wording moved.

**Architecture:** The smallest phase, and that is the finding. An audit before touching anything found **zero hardcoded colours**, headings already consistent, and only three files carrying off-scale spacing. Admin and legal inherited everything else from Phase 1's tokens without needing per-page work — which is what a design system is for.

**Spec:** `docs/superpowers/specs/2026-08-16-design-revamp-design.md`

## Global Constraints

- **No legal wording changes. Presentation only.** `src/lib/legal.ts`'s tests are the guard, and the diff must contain no prose.
- **`AFFILIATION_DISCLAIMER` stays everywhere it currently appears.**
- **Spacing uses only** Tailwind steps `1, 2, 3, 4, 6, 10, 16`.
- **`npm test` (365) and `npm run test:db` (31) stay green**, plus `tsc --noEmit`, `eslint`, `next build`.

## Audit findings

| Check | Result |
|---|---|
| Hardcoded colours | **0** |
| Off-scale spacing | 3 files: `mt-8`, `mt-12` |
| Ad-hoc heading sizes | 4, all small section labels already judged legitimate in Phase 3 — `text-sm font-semibold` used consistently, which is a pattern, not drift. **Left alone.** |

---

### Task 1: Bring the spacing onto the scale

**Files:** `src/app/legal/LegalDocumentPage.tsx`, `src/app/legal/page.tsx`, `src/app/admin/reports/[id]/page.tsx`

- [ ] **Step 1: Replace the off-scale values**

`mt-8` (2rem) → `mt-10` (2.5rem), the section step. `mt-12` (3rem) → `mt-16` (4rem), the major-band step — it precedes the rule separating a legal document from its navigation, which is the largest break on the page.

```bash
sed -i 's/\bmt-8\b/mt-10/g' src/app/legal/LegalDocumentPage.tsx src/app/legal/page.tsx "src/app/admin/reports/[id]/page.tsx"
sed -i 's/\bmt-12\b/mt-16/g' src/app/legal/LegalDocumentPage.tsx
```

- [ ] **Step 2: Confirm nothing off-scale remains anywhere in the app**

```bash
for f in $(find src/app src/components -name "*.tsx"); do
  vals=$(grep -oE "\b(m|mt|mb|mx|my|p|pt|pb|px|py|gap|space-y)-[0-9.]+" "$f" \
    | sort -u | grep -vE "\-(0|1|2|3|4|6|10|16)$" | tr '\n' ' ')
  [ -n "$vals" ] && printf "%-46s %s\n" "$f" "$vals"
done
```
Expected: only values that are deliberate and justified. Anything surprising gets fixed or explained in the commit.

- [ ] **Step 3: Prove no legal prose changed**

```bash
git diff -- src/app/legal | grep -E "^[+-]" | grep -vE "^[+-]{3}" | grep -vE "className|^\+$|^-$"
```
Expected: **no output.** Every changed line must be a `className`. If a line of prose appears, revert it — the constraint is that presentation moved and wording did not.

- [ ] **Step 4: Verify**

```bash
npm test && npm run test:db && npx tsc --noEmit && npx eslint && npx next build
```
Expected: 365, 31, all clean. `src/lib/legal.ts`'s tests passing is the guard on the documents themselves.

- [ ] **Step 5: Check the disclaimer is still everywhere**

```bash
npm run dev
```
Then confirm the footer disclaimer renders on `/`, `/legal`, `/legal/terms` and `/signin`, and remains absent on `/messages/[id]` where it is suppressed by design (Gotcha #37).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Bring admin and legal onto the spacing scale

The last three files carrying off-scale values. Presentation only: the
diff on src/app/legal contains no prose, only classNames.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Close out the revamp

**Files:** `AGENTS.md`

- [ ] **Step 1: Decision Log entry**

```markdown
- **2026-08-16** — **Phase 5 finished the revamp, and being the smallest phase was the point.** An audit of admin and legal before touching them found zero hardcoded colours, headings already consistent, and only three files carrying off-scale spacing — everything else had been inherited from Phase 1's tokens without per-page work, which is what a design system is for. The four ad-hoc heading sizes were left alone: they are small section labels using `text-sm font-semibold` consistently, which is a pattern rather than drift, and Phase 3 had already judged them so. No legal wording moved; the diff on `src/app/legal` contains only `className` changes, and `src/lib/legal.ts`'s tests are the guard.
```

- [ ] **Step 2: Update the revamp's status in Current State**

Add after the Tests line, or wherever the design work is described:

```markdown
> **Design revamp complete** (PRs #35–#41, five phases). Direction, decisions and rejected alternatives: `docs/superpowers/specs/2026-08-16-design-revamp-design.md`.
```

- [ ] **Step 3: Commit, push, PR**

```bash
git add AGENTS.md
git commit -m "Record phase 5 and close the design revamp

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin feature/design-admin-legal
```

---

## Self-Review

**Spec coverage:** Admin and legal token inheritance and light structural pass → Task 1. Legal text unchanged → Task 1 Step 3, checked mechanically rather than asserted. `AFFILIATION_DISCLAIMER` → Task 1 Step 5.

**Placeholder scan:** No TBD/TODO. Step 2's expected output is described rather than enumerated because it depends on what the sweep finds; the rule for handling it is explicit.

**Type consistency:** No new symbols.
