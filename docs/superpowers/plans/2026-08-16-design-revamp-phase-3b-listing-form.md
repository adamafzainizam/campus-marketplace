# Design Revamp — Phase 3b: The listing form

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Bring `ListingForm` and the edit page into the shared vocabulary, and turn the repeated label-to-field gap into a named relationship instead of eleven copies of a magic number.

**Architecture:** Deliberately small. An audit found the form is *internally* consistent — `gap-1.5` appears eleven times for one purpose, which is a pattern rather than drift, and drift is what reads as amateur. So this phase adds one component class, fixes three genuine inconsistencies, and stops. **No restructuring of a 537-line form that works.**

**Spec:** `docs/superpowers/specs/2026-08-16-design-revamp-design.md`

## Global Constraints

- **Zero new dependencies.**
- **Voice rule 4 is load-bearing here.** The form carries the academic-integrity notice, the halal question and the quantity wording. Money, halal, suspension and safety **stay sober** — no wit anywhere near them. `halalDisplayLabel` attributes every claim to the seller; nothing about that changes.
- **No validation logic, no field behaviour, no server-action changes.** Presentation only.
- **`npm test` (357) and `npm run test:db` (29) stay green**, plus `tsc --noEmit`, `eslint`, `next build`.
- **Reviewed at 375px and 1280px, light and dark.**

## Findings from the audit

| Finding | Count | Verdict |
|---|---|---|
| `gap-1.5` for label→field | 11 | Consistent. Becomes a named class, not a rewrite. |
| `gap-5` | 1 | Off-scale and inconsistent with its 11 siblings. Fix. |
| `text-sm font-medium` on a `<span>` acting as a label | 1 | Should be `.label`, which exists. |
| `text-xs` | 1 | Should be `.text-fine`, the project's small-text step. |

---

### Task 1: Name the label-to-field relationship

**Files:** `src/app/globals.css`, `src/app/listings/new/ListingForm.tsx`

- [ ] **Step 1: Add the class**

In `globals.css`, inside `@layer components`, after `.label`:

```css
  /* A label and the control it names are one unit, so the gap between them
     belongs to the relationship rather than to eleven separate call sites.
     0.375rem sits deliberately between steps 1 and 2 of the spacing scale:
     the scale governs the space *between* groups, and this is the space
     *inside* one. */
  .field-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
```

- [ ] **Step 2: Replace the eleven call sites**

```bash
sed -i 's/flex flex-col gap-1\.5/field-group/g' src/app/listings/new/ListingForm.tsx
grep -c "field-group" src/app/listings/new/ListingForm.tsx
grep -n "gap-1.5" src/app/listings/new/ListingForm.tsx || echo "none left"
```

If any `gap-1.5` survives, its wrapper had different classes — convert it by hand rather than widening the `sed`.

- [ ] **Step 3: Verify and commit**

`npx tsc --noEmit && npx eslint && npm test && npx next build`, then check the form renders unchanged at both widths.

```bash
git add src/app/globals.css src/app/listings/new/ListingForm.tsx
git commit -m "Name the label-to-field gap instead of repeating it eleven times

The value was already consistent, which is why the form did not read as
sloppy — but eleven copies of a magic number is one edit away from
becoming inconsistent. As a class the gap belongs to the relationship.

0.375rem sits between steps 1 and 2 of the spacing scale on purpose: the
scale governs space between groups, and this is space inside one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The three genuine inconsistencies

**Files:** `src/app/listings/new/ListingForm.tsx`

- [ ] **Step 1: Find them**

```bash
grep -nE "gap-5|text-sm font-medium|text-xs" src/app/listings/new/ListingForm.tsx
```

- [ ] **Step 2: Fix each**

- `gap-5` → `gap-6` (the section step; it separates groups, and 5 is not on the scale).
- `<span className="block text-sm font-medium">` → `<span className="label">`, since `.label` exists and is what every other field's label uses. Confirm `.label` sets `display:block` or add `block`.
- `text-xs` → `text-fine`, the project's small-text step. `text-xs` is 0.75rem against `.text-fine`'s 0.8125rem, so this is a real (small) size change, not a rename.

- [ ] **Step 3: Verify and commit**

`npx tsc --noEmit && npx eslint && npm test && npx next build`

```bash
git add src/app/listings/new/ListingForm.tsx
git commit -m "Use the shared label and small-text classes in the form

One span acting as a label styled itself with text-sm font-medium while
every sibling used .label, one gap sat off the spacing scale, and one
caption used text-xs where the project's small-text step is .text-fine.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The edit page and the form's skeletons

**Files:** `src/app/listings/[id]/edit/page.tsx`, `src/app/listings/new/loading.tsx`, `src/app/listings/[id]/edit/loading.tsx`

- [ ] **Step 1: Audit both pages the same way**

```bash
for f in "src/app/listings/[id]/edit/page.tsx" src/app/listings/new/page.tsx; do
  echo "== $f"
  grep -oE "\b(m|mt|mb|mx|my|p|pt|pb|px|py|gap)-[0-9.]+" "$f" | sort -u | tr '\n' ' '; echo
done
```
Anything outside `1 2 3 4 6 10 16` is a candidate. The `h1` override on the edit page was already fixed in Phase 3.

- [ ] **Step 2: Align the container padding with every other page**

Both should use `px-4 py-6 sm:px-6 sm:py-10`, matching home and the listing detail page. Fix any that differ.

- [ ] **Step 3: Check the skeletons still resemble their pages**

Open both `loading.tsx` files and confirm the block heights and gaps match what the form now renders. The `.field-group` change alters intra-group spacing slightly.

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit && npx eslint && npm test && npx next build`, then load `/listings/new` and an edit page at 375px and 1280px with the network throttled, so the skeletons are visible long enough to compare.

```bash
git add -A
git commit -m "Give the form pages the same container rhythm as everywhere else

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Record the phase

**Files:** `AGENTS.md`

- [ ] **Step 1: Full verification**

```bash
npm test && npm run test:db && npx tsc --noEmit && npx eslint && npx next build
```

- [ ] **Step 2: Decision Log entry**

```markdown
- **2026-08-16** — **Phase 3b was deliberately small, because the form was not the problem.** An audit before touching it found `gap-1.5` repeated eleven times for one purpose — a pattern rather than drift, and drift is what reads as amateur. So the phase added a `.field-group` class to name that relationship, fixed three genuine inconsistencies (a span styling itself as a label while its siblings used `.label`, one off-scale gap, one `text-xs` where the project's small-text step is `.text-fine`), aligned the container padding, and stopped. Restructuring a 537-line form that works would have been churn dressed as progress. Voice rule 4 governed the whole phase: the form carries the academic-integrity notice, the halal question and the quantity wording, and none of them got near a joke.
```

- [ ] **Step 3: Commit, push, PR**

```bash
git add AGENTS.md
git commit -m "Record phase 3b of the design revamp

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin feature/design-listing-form
```

---

## Self-Review

**Spec coverage:** Listing form → Tasks 1–3. Edit page → Task 3. Skeletons → Task 3. Voice → constrained rather than changed, deliberately, since the form's copy is the sober kind. Mobile parity → Tasks 1–3.

**Placeholder scan:** No TBD/TODO. Task 2 Step 2 names each of the three fixes and its replacement explicitly, including that `text-xs` → `.text-fine` is a real size change rather than a rename.

**Type consistency:** `.field-group` is defined in Task 1 Step 1 and used in Step 2. No new exported symbols.
