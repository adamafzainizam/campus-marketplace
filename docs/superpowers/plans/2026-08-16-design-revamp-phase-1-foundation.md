# Design Revamp — Phase 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retune the existing design system to the approved direction — Space Grotesk + Inter, a violet accent, one spacing vocabulary — so every later phase inherits it, and add a contrast test so the accent change is measured rather than eyeballed.

**Architecture:** This is **not** building a design system. PR #17 already built one: `@theme inline` token mapping, `.btn`/`.field`/`.chip`/`.badge`/`.card`/`.notice`/`.rail` with variants, a type scale with size-specific tracking, and three independent accessibility media queries. Phase 1 changes **tokens and fonts only**, plus one new pure module. No component markup changes; those belong to phases 2–5.

**Tech Stack:** Next.js 16 App Router, Tailwind v4 (CSS-based `@theme`, no JS config), `next/font/google`, `node:test`. **Zero new dependencies.**

**Spec:** `docs/superpowers/specs/2026-08-16-design-revamp-design.md`

## Global Constraints

- **Zero new dependencies.** Standing constraint since 2026-08-12.
- **Fonts self-hosted via `next/font/google` only.** The CSP is `font-src 'self' data:`; a `<link>` to `fonts.googleapis.com` would be the fourth CSP-caused production outage (Gotchas #31, #34).
- **Verify the *computed* font, not that the build passed.** Gotcha #36: `globals.css` silently overrode the webfont with Arial for the project's entire life.
- **No component markup changes in this phase.** Tokens, fonts and one new `src/lib` module only.
- **`npm test` (330) and `npm run test:db` (29) stay green**, plus `tsc --noEmit`, `eslint`, `next build`.
- **Reviewed at 375px and 1280px, in light and dark**, before the phase is called done.
- **Check the conversation thread after any `globals.css` change** — the `min-h-0` chain and `body:has(.thread-viewport) > footer` have broken twice (Gotchas #33, #37).
- **Exact accent values**, copied from the spec:

  | Token | Light | Dark |
  |---|---|---|
  | `--accent` | `oklch(52% 0.20 295)` | `oklch(72% 0.17 295)` |
  | `--accent-hover` | `oklch(46% 0.19 295)` | `oklch(78% 0.15 295)` |
  | `--accent-subtle` | `oklch(95% 0.04 295)` | `oklch(30% 0.08 295)` |
  | `--accent-contrast` | `oklch(99% 0 0)` | `oklch(16% 0.01 295)` |

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/color-contrast.ts` (create) | Pure OKLCH → sRGB → WCAG contrast maths. No I/O, no DOM. |
| `src/lib/color-contrast.test.ts` (create) | Validates the maths against known values, then asserts the real token pairs meet AA. |
| `src/app/layout.tsx` (modify) | Font imports and the `<html>` class. |
| `src/app/globals.css` (modify) | Accent tokens (light + dark), `@theme` font keys, `body` and heading `font-family`, spacing-vocabulary comment. |
| `AGENTS.md` (modify) | Decision Log, the spacing rule, and a gotcha. |

---

### Task 1: Drop the unused mono font

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css` (the `@theme inline` block)

**Interfaces:**
- Consumes: nothing.
- Produces: one fewer webfont on every page. No API surface.

`Geist_Mono` is imported, given a CSS variable, mapped into `@theme`, and referenced by **zero** components — verified with `grep -rn "font-mono" src/`. It is downloaded on every page load for nothing. Doing this first also shrinks the surface of the font swap in Task 3.

- [ ] **Step 1: Confirm it is genuinely unused**

Run:
```bash
grep -rn "font-mono\|--font-geist-mono" src/ --include=*.tsx --include=*.css
```
Expected: matches **only** in `src/app/layout.tsx` (the import and `variable:`) and `src/app/globals.css` (the `@theme` line). If any component uses `font-mono`, **stop** — keep the font and skip this task.

- [ ] **Step 2: Remove the import and the variable**

In `src/app/layout.tsx`, change:
```ts
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```
to:
```ts
import { Geist } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
```

And change the `<html>` className from:
```tsx
className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
```
to:
```tsx
className={`${geistSans.variable} h-full antialiased`}
```

- [ ] **Step 3: Remove the theme mapping**

In `src/app/globals.css`, delete this line from the `@theme inline` block:
```css
  --font-mono: var(--font-geist-mono);
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx eslint && npx next build`
Expected: all clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "Stop shipping a mono font nothing uses

Geist Mono was imported, given a CSS variable and mapped into the theme,
and referenced by no component. It was downloaded on every page load for
nothing, which matters most on the phones this site is mostly read on.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Contrast maths, so the accent is measured

**Files:**
- Create: `src/lib/color-contrast.ts`
- Create: `src/lib/color-contrast.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseOklch(value: string): { l: number; c: number; h: number }` — throws on malformed input
  - `oklchToLinearSrgb(color: {l,c,h}): { r: number; g: number; b: number }` — linear, clamped to [0,1]
  - `relativeLuminance(value: string): number`
  - `contrastRatio(a: string, b: string): number`
  - `meetsAA(a: string, b: string, large?: boolean): boolean` — 4.5, or 3.0 when `large`

The spec's guardrail 7 says accent contrast "is measured during implementation, not asserted here". This is that measurement, and as a test it keeps holding when somebody retunes the accent later.

- [ ] **Step 1: Write the failing test**

Create `src/lib/color-contrast.test.ts`:

```ts
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  contrastRatio,
  meetsAA,
  parseOklch,
  relativeLuminance,
} from "./color-contrast.ts";

describe("parseOklch", () => {
  test("reads lightness as a fraction, chroma and hue as given", () => {
    assert.deepEqual(parseOklch("oklch(52% 0.20 295)"), {
      l: 0.52,
      c: 0.2,
      h: 295,
    });
  });

  test("accepts a unitless lightness", () => {
    assert.deepEqual(parseOklch("oklch(0.52 0.20 295)"), {
      l: 0.52,
      c: 0.2,
      h: 295,
    });
  });

  test("rejects anything that is not an oklch colour", () => {
    assert.throws(() => parseOklch("#ffffff"));
    assert.throws(() => parseOklch("rgb(0,0,0)"));
  });
});

describe("relativeLuminance", () => {
  // Anchors the whole conversion chain. If these two are right, the OKLab
  // matrices are wired correctly; if they drift, everything downstream lies.
  test("white is 1 and black is 0", () => {
    assert.ok(Math.abs(relativeLuminance("oklch(100% 0 0)") - 1) < 0.01);
    assert.ok(Math.abs(relativeLuminance("oklch(0% 0 0)") - 0) < 0.01);
  });

  test("mid grey sits between them", () => {
    const mid = relativeLuminance("oklch(50% 0 0)");
    assert.ok(mid > 0.1 && mid < 0.35, `mid grey luminance was ${mid}`);
  });
});

describe("contrastRatio", () => {
  test("black on white is 21:1", () => {
    const ratio = contrastRatio("oklch(0% 0 0)", "oklch(100% 0 0)");
    assert.ok(Math.abs(ratio - 21) < 0.5, `expected ~21, got ${ratio}`);
  });

  test("a colour against itself is 1:1", () => {
    assert.ok(
      Math.abs(contrastRatio("oklch(52% 0.20 295)", "oklch(52% 0.20 295)") - 1) <
        0.01,
    );
  });

  test("is symmetric", () => {
    const a = contrastRatio("oklch(20% 0 0)", "oklch(95% 0 0)");
    const b = contrastRatio("oklch(95% 0 0)", "oklch(20% 0 0)");
    assert.ok(Math.abs(a - b) < 0.001);
  });
});

describe("the accent tokens actually shipping", () => {
  // These are the values from the design spec. If somebody retunes the
  // accent later and breaks contrast, this fails rather than shipping.
  const lightSurface = "oklch(99.2% 0.002 265)";
  const darkSurface = "oklch(17.5% 0.007 265)";

  test("light: button label on the accent fill meets AA", () => {
    assert.ok(
      meetsAA("oklch(99% 0 0)", "oklch(52% 0.20 295)"),
      `ratio was ${contrastRatio("oklch(99% 0 0)", "oklch(52% 0.20 295)")}`,
    );
  });

  test("light: accent text on the page surface meets AA", () => {
    assert.ok(
      meetsAA("oklch(52% 0.20 295)", lightSurface),
      `ratio was ${contrastRatio("oklch(52% 0.20 295)", lightSurface)}`,
    );
  });

  test("dark: button label on the accent fill meets AA", () => {
    assert.ok(
      meetsAA("oklch(16% 0.01 295)", "oklch(72% 0.17 295)"),
      `ratio was ${contrastRatio("oklch(16% 0.01 295)", "oklch(72% 0.17 295)")}`,
    );
  });

  test("dark: accent text on the page surface meets AA", () => {
    assert.ok(
      meetsAA("oklch(72% 0.17 295)", darkSurface),
      `ratio was ${contrastRatio("oklch(72% 0.17 295)", darkSurface)}`,
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './color-contrast.ts'`.

- [ ] **Step 3: Write the module**

Create `src/lib/color-contrast.ts`:

```ts
/**
 * OKLCH → sRGB → WCAG contrast, as pure functions.
 *
 * The design tokens are authored in OKLCH because equal numeric lightness
 * steps look equal to the eye (Decision Log 2026-08-15). The cost is that you
 * cannot eyeball whether a pair meets contrast requirements, so this converts
 * properly and measures.
 *
 * The conversion is the standard one: OKLCH → OKLab → LMS → linear sRGB.
 * WCAG's relative luminance is defined on *linearised* sRGB, which is exactly
 * what the last step produces, so no gamma round-trip is needed.
 *
 * Deliberately no DOM and no I/O, so it runs in the fast offline suite.
 */

export type Oklch = { l: number; c: number; h: number };

const OKLCH = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/i;

/** Lightness comes back as a 0–1 fraction whether it was written `52%` or `0.52`. */
export function parseOklch(value: string): Oklch {
  const match = OKLCH.exec(value.trim());
  if (!match) {
    throw new Error(`Not an oklch() colour: ${value}`);
  }

  const [, rawL, percent, rawC, rawH] = match;
  const l = Number(rawL) / (percent === "%" ? 100 : 1);

  return { l, c: Number(rawC), h: Number(rawH) };
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export function oklchToLinearSrgb(color: Oklch): {
  r: number;
  g: number;
  b: number;
} {
  const hRad = (color.h * Math.PI) / 180;
  const a = color.c * Math.cos(hRad);
  const b = color.c * Math.sin(hRad);

  const lCube = color.l + 0.3963377774 * a + 0.2158037573 * b;
  const mCube = color.l - 0.1055613458 * a - 0.0638541728 * b;
  const sCube = color.l - 0.0894841775 * a - 1.291485548 * b;

  const long = lCube ** 3;
  const medium = mCube ** 3;
  const short = sCube ** 3;

  return {
    r: clamp01(
      4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    ),
    g: clamp01(
      -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    ),
    b: clamp01(
      -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
    ),
  };
}

export function relativeLuminance(value: string): number {
  const { r, g, b } = oklchToLinearSrgb(parseOklch(value));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2 AA: 4.5:1 for body text, 3:1 for large text. */
export function meetsAA(a: string, b: string, large = false): boolean {
  return contrastRatio(a, b) >= (large ? 3 : 4.5);
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS, 330 + 12 = **342 tests**.

**If a token pair fails AA**, do not weaken the test. Adjust the token's lightness in the spec table and here together, and note the change in the commit message — the point of the test is that the palette bends, not the standard.

- [ ] **Step 5: Verify the maths is not self-confirming**

Temporarily change the red coefficient in `relativeLuminance` from `0.2126` to `0.5`, run `npm test`, and confirm the black-on-white 21:1 test fails. Revert.

Expected: FAIL while mutated, PASS after revert. Without this, a wrong matrix would produce confident wrong numbers.

- [ ] **Step 6: Type-check, lint, commit**

Run: `npx tsc --noEmit && npx eslint`

```bash
git add src/lib/color-contrast.ts src/lib/color-contrast.test.ts
git commit -m "Measure token contrast instead of eyeballing it

Tokens are authored in OKLCH because equal lightness steps look equal,
and the cost of that is you cannot eyeball whether a pair passes WCAG.
This converts OKLCH to linear sRGB properly and measures.

The conversion is anchored by white=1 and black=0 luminance tests, so a
wrong matrix fails loudly rather than producing confident wrong numbers,
and the real shipping token pairs are asserted to meet AA in both light
and dark.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Swap Geist for Space Grotesk + Inter

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css` (`@theme inline`, `body`, heading rules)

**Interfaces:**
- Consumes: Task 1's single-font layout.
- Produces: CSS variables `--font-space-grotesk` and `--font-inter` on `<html>`; Tailwind theme keys `--font-sans` (Inter) and `--font-display` (Space Grotesk), giving the `font-sans` and `font-display` utilities to later phases.

Geist is Vercel's own typeface and about as close to a default AI-app signature as a typeface gets. This is the single highest-impact change against "characterless".

- [ ] **Step 1: Replace the font imports**

In `src/app/layout.tsx`:
```ts
import { Inter, Space_Grotesk } from "next/font/google";

/**
 * Two families, loaded through next/font so they are self-hosted at build
 * time. The CSP is `font-src 'self' data:` — a <link> to fonts.googleapis.com
 * would be blocked, and would be the fourth outage that policy has caused.
 */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});
```

And the `<html>` className:
```tsx
className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
```

- [ ] **Step 2: Repoint the theme keys**

In `src/app/globals.css`, inside `@theme inline`, replace:
```css
  --font-sans: var(--font-geist-sans);
```
with:
```css
  --font-sans: var(--font-inter);
  --font-display: var(--font-space-grotesk);
```

- [ ] **Step 3: Repoint the body font**

In `src/app/globals.css`, in the `body` rule, replace:
```css
  font-family: var(--font-geist-sans), system-ui, -apple-system, sans-serif;
```
with:
```css
  /* Gotcha #36: the rule that lived here once hard-coded Arial and silently
     beat the loaded webfont for the project's entire life. Verify the
     *computed* font in a browser after changing this, not that the build
     passed. */
  font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
```

- [ ] **Step 4: Give headings the display face**

In `src/app/globals.css`, find the heading rule that begins:
```css
h1, .text-display {
```
Add as its first declaration:
```css
  font-family: var(--font-space-grotesk), var(--font-inter), system-ui, sans-serif;
```

Do the same for the `h2` and `h3` rules in that same type-scale block. Leave body copy, `.hint`, `.label` and form controls on Inter — the display face is for headings and prices only, and putting it on small UI text is what makes a distinctive typeface tiring.

- [ ] **Step 5: Verify the computed font in a real browser**

Run `npm run dev`, open `http://localhost:3000`, and in DevTools:
- Select a paragraph → Computed → `font-family` must resolve to **Inter**.
- Select the page heading → Computed → must resolve to **Space Grotesk**.

Then confirm the fonts are same-origin: DevTools → Network → filter `Font`. Every entry's domain must be `localhost`. **A request to `fonts.gstatic.com` means `next/font` was bypassed — stop and fix it**, because it will be blocked by the CSP in production and every page will fall back to system fonts.

This step is the whole reason Gotcha #36 exists. A green build proves nothing here.

- [ ] **Step 6: Confirm the CSP still passes its own tests**

Run: `npm test`
Expected: 342 passing, including `src/lib/security-headers.test.ts` unchanged. `next/font` self-hosts, so `font-src 'self' data:` needs no edit — this confirms it rather than assuming it.

- [ ] **Step 7: Full checks and commit**

Run: `npx tsc --noEmit && npx eslint && npx next build`

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "Swap Geist for Space Grotesk and Inter

Geist is Vercel's own typeface and about as close to a default AI-app
signature as a typeface gets, which is most of why the site read as
characterless. Space Grotesk carries headings and prices; Inter carries
body and UI, because a distinctive face on small text gets tiring.

Both load through next/font and are self-hosted at build time, so the
CSP's font-src 'self' needs no change. Verified by reading the computed
font in a browser and confirming every font request is same-origin —
Gotcha #36 is precisely the failure a green build does not catch.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Retune the accent to violet

**Files:**
- Modify: `src/app/globals.css` (`:root` and the `prefers-color-scheme: dark` block)

**Interfaces:**
- Consumes: Task 2's contrast tests, which already assert these exact values.
- Produces: the shipping accent. Everything using `--accent`, `--color-accent`, `.btn-primary`, `.badge-accent`, `.chip-selected` and focus rings changes with it, with no per-component edits.

Green and red were excluded on systems grounds: `--success` owns hue 155 and `--danger` owns hue 25, and an accent near either makes "saved successfully" and "this is a link" the same signal.

- [ ] **Step 1: Replace the light-mode accent tokens**

In `src/app/globals.css`, in `:root`, replace:
```css
  --accent: oklch(54% 0.17 258);
  --accent-hover: oklch(48% 0.17 258);
  --accent-contrast: oklch(99% 0 0);
  --accent-subtle: oklch(96% 0.03 258);
```
with:
```css
  /* Violet, chosen partly because it is the furthest hue from everything
     already spoken for: --success owns 155 and --danger owns 25, and an
     accent near either makes "saved" and "this is a link" the same signal.
     Contrast against the surfaces is asserted in color-contrast.test.ts. */
  --accent: oklch(52% 0.20 295);
  --accent-hover: oklch(46% 0.19 295);
  --accent-contrast: oklch(99% 0 0);
  --accent-subtle: oklch(95% 0.04 295);
```

- [ ] **Step 2: Replace the dark-mode accent tokens**

In the `@media (prefers-color-scheme: dark)` block, replace:
```css
    --accent: oklch(70% 0.15 258);
    --accent-hover: oklch(76% 0.15 258);
    --accent-contrast: oklch(17% 0.01 265);
    --accent-subtle: oklch(28% 0.06 258);
```
with:
```css
    --accent: oklch(72% 0.17 295);
    --accent-hover: oklch(78% 0.15 295);
    --accent-contrast: oklch(16% 0.01 295);
    --accent-subtle: oklch(30% 0.08 295);
```

- [ ] **Step 3: Confirm no blue accent value survives**

Run:
```bash
grep -n "258" src/app/globals.css
```
Expected: **no matches inside any `--accent*` declaration.** Other tokens legitimately use nearby hues for neutrals; only accent lines matter here.

- [ ] **Step 4: Run the contrast tests against the shipped values**

Run: `npm test`
Expected: 342 passing. The four "accent tokens actually shipping" tests from Task 2 are now measuring what is really in the stylesheet.

- [ ] **Step 5: Look at it in both schemes**

Run `npm run dev` and check `http://localhost:3000` at **375px and 1280px**, in **light and dark** (DevTools → Rendering → Emulate CSS `prefers-color-scheme`).

Confirm: primary buttons, focus rings, selected category chips and links are violet in both schemes; success and danger notices are still clearly distinguishable from the accent; nothing has become unreadable.

- [ ] **Step 6: Check the conversation thread specifically**

Open a thread at `/messages/[id]` at 375px. Confirm the page still fills the viewport without the whole page scrolling, and that the footer is absent. Gotchas #33 and #37 — this has broken twice from changes made elsewhere.

- [ ] **Step 7: Full checks and commit**

Run: `npx tsc --noEmit && npx eslint && npx next build`

```bash
git add src/app/globals.css
git commit -m "Retune the accent from default blue to violet

The old accent was the safest blue available and a close cousin of the
'AI beige' tell. Violet sits furthest in hue from everything already in
the system — success owns 155, danger owns 25 — so there are no semantic
collisions, and it holds up better on dark surfaces.

Contrast in both schemes is asserted by color-contrast.test.ts rather
than eyeballed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Document the spacing vocabulary and the phase

**Files:**
- Modify: `src/app/globals.css` (a comment in the Base section)
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the rule phases 2–5 are held to.

"Looks amateur" was diagnosed as a spacing-consistency problem. The spec's scale maps almost exactly onto Tailwind's default numeric steps, so **no new tokens are added** — inventing `--spacing-lg` beside Tailwind's `4`/`6`/`10` would create two vocabularies for one idea, which is how inconsistency starts.

- [ ] **Step 1: Record the vocabulary where it will be read**

In `src/app/globals.css`, immediately above the `body` rule, add:

```css
/* Spacing vocabulary — seven steps, no others.
   Uniform spacing is what actually reads as amateur, so the rule that
   matters more than the numbers: the gap *between* two related things must
   be smaller than the gap to the next group.

     1  (0.25rem)  icon-to-text
     2  (0.5rem)   inside chips and badges
     3  (0.75rem)  card padding and grid gaps on a phone
     4  (1rem)     card padding and grid gaps on desktop
     6  (1.5rem)   between page sections on a phone
     10 (2.5rem)   between page sections on desktop
     16 (4rem)     above and below major page bands

   These are Tailwind's own numeric steps. A parallel set of named tokens
   was considered and rejected: two vocabularies for one idea is how the
   inconsistency this is meant to fix gets started. */
```

- [ ] **Step 2: Add the Decision Log entries to `AGENTS.md`**

Insert before the `- **2026-08-11** — Resolved the \`r2.dev\` vs. custom-domain deferral` entry:

```markdown
- **2026-08-16** — **Design direction: "student-made, and proud of it", grounded in why the project exists.** Selling at GMI happens in WhatsApp and Telegram groups where a listing is buried within twenty minutes, there is no search and photos compress to mush; the product's argument is that this stuff should have somewhere to live, and the voice follows from that. The direction also serves the legal position rather than straining it — a site that visibly reads as a student project is the strongest available evidence that it is not an official GMI service, which is exactly what the affiliation disclaimer and the pending GMI letter exist to establish. A more polished, institutional look would *increase* that risk. Full design spec at `docs/superpowers/specs/2026-08-16-design-revamp-design.md`.
- **2026-08-16** — **Geist replaced by Space Grotesk (headings) and Inter (body).** Geist is Vercel's own typeface and about as close to a default AI-app signature as a typeface gets, which was most of why the UI read as characterless despite having a real design system behind it. Chosen from three pairings rendered with the site's own copy rather than from description. Geist Mono was dropped entirely in the same pass: it was imported, given a variable, mapped into the theme, and used by no component — a webfont downloaded on every page load for nothing.
- **2026-08-16** — **The accent moved from blue to violet, on systems grounds as much as taste.** `--success` already owns hue 155 and `--danger` owns hue 25, so an accent near either would make "saved successfully" and "this is a link" the same signal; violet sits furthest from both and survives dark mode better. Contrast is no longer eyeballed: `src/lib/color-contrast.ts` converts OKLCH to linear sRGB and `color-contrast.test.ts` asserts every shipping pair meets WCAG AA in both schemes, anchored by white=1 / black=0 luminance tests so a wrong matrix fails loudly instead of producing confident wrong numbers.
- **2026-08-16** — **No spacing tokens were added.** The agreed scale maps onto Tailwind's own numeric steps, and a parallel named set beside them would be two vocabularies for one idea — which is how the inconsistency it was meant to fix begins. The seven permitted steps and the grouping rule are recorded as a comment in `globals.css`, where someone editing spacing will actually see them.
```

- [ ] **Step 3: Add a gotcha**

Append to the Known Gotchas list, numbered 46:

```markdown
46. **A font swap is not verified by a green build — read the computed font and the network panel.** Gotcha #36 recorded `globals.css` silently overriding the webfont with Arial for the project's entire life, invisible because Arial is unremarkable rather than obviously wrong. The same trap applies to any font change, plus a second one: if `next/font` is bypassed and a family is loaded by URL instead, the page still looks right in development and then falls back to system fonts in production, because the CSP is `font-src 'self' data:`. Both checks take seconds in DevTools — Computed → `font-family`, and Network → filter Font, where every request must be same-origin.
```

- [ ] **Step 4: Update the test count in Current State**

In `AGENTS.md`, change:
```
> **Tests:** 330 passing (`npm test`), plus 29 database-backed
```
to:
```
> **Tests:** 342 passing (`npm test`), plus 29 database-backed
```

- [ ] **Step 5: Full verification**

Run:
```bash
npm test && npm run test:db && npx tsc --noEmit && npx eslint && npx next build
```
Expected: 342 passing, 29 passing, all clean.

- [ ] **Step 6: Commit and open the PR**

```bash
git add src/app/globals.css AGENTS.md
git commit -m "Record the design foundation in the bridge document

Logs the direction and why it serves the legal position, the typeface
and accent changes with their reasoning, and the decision not to add
spacing tokens. Adds Gotcha #46: a font swap is not verified by a green
build, and next/font being bypassed looks fine in development and falls
back to system fonts in production.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

git push -u origin feature/design-foundation
```

Then open a PR covering: what was diagnosed, the three decisions and how each was made, the contrast module and its anchoring tests, and screenshots at 375px and 1280px in both schemes.

---

## Roadmap — phases 2 to 5

Each gets its own plan, written when its turn comes, because page markup cannot be specified honestly until the layer beneath it exists. Each ends deployable, so the revamp can stop anywhere without leaving the site half-restyled.

| Phase | Deliverable |
|---|---|
| 2 | **Home** — headline band, category rail, grid at 2/3/4 columns, empty states, the new placeholder. Includes updating `src/app/loading.tsx` so the skeleton matches the new layout. |
| 3 | **Listing detail, listing form, `/listings/mine`, sign-in** — plus their `loading.tsx` skeletons. |
| 4 | **Messages** — inbox and thread. The thread's height contract is handled explicitly (Gotchas #33, #37). |
| 5 | **Admin and legal** — token inheritance and a light structural pass. **Zero text changes**; `src/lib/legal.ts`'s 18 tests stay green and `AFFILIATION_DISCLAIMER` stays everywhere it is now. |

Copy is applied within each phase rather than as a separate pass, so no page is left half-revoiced.

## Self-Review

**Spec coverage:** Typography → Task 3. Accent → Task 4, measured by Task 2. Spacing → Task 5. Guardrail 1 (self-hosted fonts) → Task 3 Steps 5–6. Guardrail 2 (Gotcha #36) → Task 3 Step 5. Guardrail 4 (thread contract) → Task 4 Step 6. Guardrail 6 (mobile) → Task 4 Step 5. Guardrail 7 (contrast, accessibility signals) → Task 2. Guardrail 3 (skeletons) and guardrail 5 (legal text) belong to phases 2–5 and are carried in the roadmap, since Phase 1 changes no markup. Voice and layout are phases 2–5. No gaps within Phase 1's scope.

**Placeholder scan:** No TBD/TODO. Every code step carries real code. The one conditional — a token pair failing AA — states what to do and explicitly forbids weakening the test.

**Type consistency:** `parseOklch` / `oklchToLinearSrgb` / `relativeLuminance` / `contrastRatio` / `meetsAA` are used in the test exactly as defined in the module. CSS variable names `--font-space-grotesk` and `--font-inter` are consistent across `layout.tsx`, `@theme`, `body` and the heading rules. Test counts run 330 → 342 consistently from Task 2 onward.
