# Design Revamp — Phase 4: Messages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Give the inbox the same empty-state treatment and voice as the rest of the site, and leave the conversation thread's deliberate deviations documented rather than looking like drift.

**Architecture:** Small. The thread page is the most fragile page in the app — its height contract has broken twice from changes made elsewhere — so this phase changes as little as possible there and verifies rather than restyles.

**Spec:** `docs/superpowers/specs/2026-08-16-design-revamp-design.md`

## Global Constraints

- **The thread's height contract is not to be touched.** `min-h-0` flex chain and `body:has(.thread-viewport) > footer { display: none }` (Gotchas #33, #37). If a change requires touching it, stop and say so.
- **Spacing uses only** Tailwind steps `1, 2, 3, 4, 6, 10, 16`.
- **Voice rules apply**, and the thread is a friction-adjacent surface: the suspension notice stays sober.
- **`npm test` (364) and `npm run test:db` (31) stay green**, plus `tsc --noEmit`, `eslint`, `next build`.
- **Reviewed at 375px and 1280px, light and dark**, and the thread specifically at 375px.

---

### Task 1: Inbox copy, tested

**Files:** `src/lib/site-copy.ts`, `src/lib/site-copy.test.ts`

- [ ] **Step 1: Add the constant and extend the voice tests**

Append to `src/lib/site-copy.ts`:

```ts
/* -------------------------------------------------------------------- /messages */

/**
 * A state of possibility. The second sentence is the product's argument again:
 * a message here is findable later, unlike one in a group chat.
 */
export const INBOX_EMPTY = {
  title: "No conversations yet",
  body: "When someone wants your stuff, it lands here — not buried under forty messages.",
};
```

Add `INBOX_EMPTY.title` and `INBOX_EMPTY.body` to the `everything` array in the test file so the no-shouting and no-placeholder rules cover them, and add:

```ts
describe("inbox copy", () => {
  it("makes the product's argument rather than just stating a fact", () => {
    assert.match(INBOX_EMPTY.body, /buried|group chat|forty/i);
  });
});
```

- [ ] **Step 2: Verify and commit**

`npm test` → **365 passing**. Then `npx tsc --noEmit && npx eslint`.

```bash
git add src/lib/site-copy.ts src/lib/site-copy.test.ts
git commit -m "Give the inbox empty state a voice

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The inbox

**Files:** `src/app/messages/page.tsx`, `src/app/messages/loading.tsx`

- [ ] **Step 1: Use the card empty state**

Replace:
```tsx
        <p className="text-secondary">
          No conversations yet. Message a seller from a listing to start one.
        </p>
```
with:
```tsx
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center sm:py-20">
          <p className="text-display">{INBOX_EMPTY.title}</p>
          <p className="max-w-sm text-fine text-secondary">{INBOX_EMPTY.body}</p>
          <Link href="/" className="btn btn-primary btn-sm mt-1">
            Browse listings
          </Link>
        </div>
```

Import `INBOX_EMPTY` from `@/lib/site-copy`. Confirm `Link` is already imported; add it if not.

The button goes to browse rather than to a listing, because there is nothing to message about until you have found something — this is the same shape the home page and `/listings/mine` use.

- [ ] **Step 2: Check the inbox spacing**

```bash
grep -oE "\b(m|mt|mb|mx|my|p|pt|pb|px|py|gap)-[0-9.]+" src/app/messages/page.tsx | sort -u | tr '\n' ' '
```
Anything outside `1 2 3 4 6 10 16` gets moved to the nearest permitted step, applying the grouping rule.

- [ ] **Step 3: Match the skeleton**

`src/app/messages/loading.tsx` models the populated list, which is correct — a skeleton shows while data loads, and the empty state is a result. Confirm its heading skeleton matches `mb-6 sm:mb-10` from the page, and its rows still resemble the list.

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit && npx eslint && npm test && npx next build`

```bash
git add src/app/messages/page.tsx src/app/messages/loading.tsx
git commit -m "Give the inbox the same empty state as everywhere else

A bare sentence reads as an error rather than an invitation, and looked
nothing like the home page's or /listings/mine's.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The thread — document, don't restyle

**Files:** `src/app/messages/[id]/page.tsx`

The thread is the most fragile page in the app. Its height contract has broken twice from changes made elsewhere (Gotchas #33, #37). **Nothing here changes layout.**

- [ ] **Step 1: Explain the heading deviation**

`<h1 className="text-lg font-semibold">` bypasses the `h1` type scale, and Phase 3 deliberately left it. It is correct — `h1`'s clamp tops out at 2.25rem, which would eat viewport height on a page that sizes itself to the space that is left — but it currently looks like the drift Phase 3 was fixing. Add above it:

```tsx
        {/*
          Deliberately off the h1 type scale. That scale tops out at 2.25rem,
          which is right for a page title and wrong here: this is a compact bar
          above a conversation that sizes itself to the remaining viewport, and
          every pixel it takes comes out of the messages. The display face
          still applies — it comes from the shared h1/h2/h3 font rule, which
          this only overrides for size and weight.
        */}
```

- [ ] **Step 2: Check the thread's spacing**

```bash
grep -oE "\b(m|mt|mb|mx|my|p|pt|pb|px|py|gap)-[0-9.]+" "src/app/messages/[id]/page.tsx" | sort -u | tr '\n' ' '
```
Move off-scale values **only where they are not part of the height chain**. Anything on an element carrying `flex-1`, `min-h-0` or `thread-viewport` is left alone regardless — those values are load-bearing, and the scale is a style rule, not a licence to break layout.

- [ ] **Step 3: Verify the contract still holds**

`npm run dev`, open a thread at **375px**:
- the page fills the viewport and does not scroll as a whole
- the message list scrolls internally
- the footer is absent
- the composer stays visible at the bottom

- [ ] **Step 4: Commit**

```bash
git add "src/app/messages/[id]/page.tsx"
git commit -m "Say why the thread heading is off the type scale

It looked like exactly the drift phase 3 was fixing. It is not: the h1
scale tops out at 2.25rem, and every pixel of a heading on this page
comes out of the conversation below it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Record and open the PR

**Files:** `AGENTS.md`

- [ ] **Step 1: Full verification**

```bash
npm test && npm run test:db && npx tsc --noEmit && npx eslint && npx next build
```

- [ ] **Step 2: Decision Log entry**

```markdown
- **2026-08-16** — **Phase 4 changed the inbox and deliberately left the thread alone.** The inbox empty state was a bare sentence, the same shape `/listings/mine` had, and now uses the site's card treatment with copy that makes the product's argument rather than stating a fact. The conversation thread got **no layout change at all**: it is the most fragile page in the app, its height contract has broken twice from changes made elsewhere (Gotchas #33, #37), and the one thing that looked like drift — an `h1` off the type scale — is correct, because that scale tops out at 2.25rem and every pixel of heading on that page comes out of the conversation. It carries a comment saying so now, which is the actual fix: the problem was that a deliberate deviation was indistinguishable from an accidental one.
```

- [ ] **Step 3: Update the test count and commit**

Change `> **Tests:** 364 passing` to `> **Tests:** 365 passing`.

```bash
git add AGENTS.md
git commit -m "Record phase 4 of the design revamp

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin feature/design-messages
```

---

## Self-Review

**Spec coverage:** Inbox → Tasks 1–2. Thread → Task 3. Skeletons → Task 2 Step 3. Mobile parity and the height contract → Task 3 Step 3. Voice → Task 1, tested.

**Placeholder scan:** No TBD/TODO. Task 3 Step 2 is conditional by necessity and states the rule precisely: off-scale values move *except* on elements carrying `flex-1`, `min-h-0` or `thread-viewport`.

**Type consistency:** `INBOX_EMPTY` is defined in Task 1 and used in Task 2 with matching `.title`/`.body`. Count runs 364 → 365.
