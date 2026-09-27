# Overhaul Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the violet/rounded/translucent design system with the "Notice board" system (ink + highlighter yellow, 3px corners, offset shadows, Archivo, Phosphor icons) so that every page changes through the shared tokens and classes, with no page layout edits.

**Architecture:** All colour lives in a `--brand-*` primitives block in `src/app/globals.css`; semantic tokens reference only primitives through `light-dark()`, so a future GMI palette is a one-block edit. Shared component classes keep their names and are rebuilt on the new tokens. Two tests enforce the system: one reads the primitives and asserts WCAG contrast, one asserts the two-layer structure and that the retired `accent` vocabulary is gone.

**Tech Stack:** Next.js 16 (App Router), Tailwind v4 with `@theme inline`, Lightning CSS (polyfills `light-dark()`), `next/font/google`, `node:test`, `@phosphor-icons/react` 2.1.x.

**Spec:** `docs/superpowers/specs/2026-09-27-notice-board-overhaul-design.md` (sections 1, 3, 4). **Visual reference:** `docs/superpowers/specs/assets/2026-09-27-notice-board/reference.png` (open it; dark mode is option 2, grey shadows).

## Global Constraints

- Branch: `feature/overhaul-1-foundation`, created from `main` after the spec branch merges (or from `docs/notice-board-overhaul-spec` if it has not). Never commit on `main`.
- **Never stage `README.md` or `docs/case-study.md`**; they carry the builder's uncommitted edits. Always `git add` explicit paths.
- Colour literals (`oklch(`, `#hex`, `rgb(`, `hsl(`) may appear in the `:root` block **only** on `--brand-*` lines.
- In light mode yellow is never text or a hairline **on a light surface** (paper, card, sunken): there it is only a fill with ink on it. Yellow text on an ink fill (the light-mode primary button, about 14:1) is the approved design.
- Radius: `3px` everywhere, `2px` on tags and badges. No pills.
- Borders `1.5px`. Header bottom border `2px`.
- Shadows are hard offsets (`Npx Npx 0 var(--shadow-color)`), never blurred.
- Motion: CSS only, animate only `transform`, `box-shadow`, `opacity`, `background-color`, `border-color`; hover effects inside `@media (hover: hover)`; `prefers-reduced-motion: reduce` removes all translation.
- Button labels never wrap (`white-space: nowrap` is already on `.btn`; keep it).
- No em-dash (`—`) or en-dash (`–`) in any **visible UI string** you add. Code comments may use them.
- Fonts only through `next/font` (CSP is `font-src 'self' data:`, Known Gotcha #46).
- Tests use relative imports with explicit `.ts` extensions (Gotchas #20, #21, #23).
- **Commit before any mutation test; never `git checkout` uncommitted work** (Gotcha #50).
- Every task ends with all four green: `npm test`, `npx tsc --noEmit`, `npx eslint`, `npx next build`.
- Built CSS lives in `.next/static/chunks/*.css` (print it with `ls` first, Gotcha #47). `light-dark()` does not appear literally in built CSS; it is polyfilled into `--lightningcss-light`/`--lightningcss-dark` pairs.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`

## File map

| File | Responsibility | Tasks |
|---|---|---|
| `src/app/globals.css` | Tokens, base type, interaction, component classes | 1, 2, 3 |
| `src/lib/color-contrast.test.ts` | WCAG contrast of shipped palette (reads `globals.css`) | 1 |
| `src/lib/design-tokens.test.ts` (new) | Two-layer structure, retired vocabulary | 1 |
| 9 `.tsx` call sites using `accent` utilities | Migrate to new utilities | 1 |
| `src/app/loading.tsx`, `src/app/listings/[id]/loading.tsx`, `src/app/listings/new/ListingForm.tsx`, `src/app/listings/[id]/ListingGallery.tsx` | Pill radii to square | 2 |
| `src/app/layout.tsx` | Archivo via `next/font` | 3 |
| `package.json`, `package-lock.json` | `@phosphor-icons/react` | 4 |
| `src/components/icon-style.ts` (new) | The one icon weight | 4 |
| `src/components/ThemeToggle.tsx`, `NoPhoto.tsx`, `PhotoPicker.tsx` | Phosphor icons | 4 |
| `src/components/PinMark.tsx`, `src/app/icon.svg`, `src/app/icon.test.ts` | Brand mark recolour and corner | 5 |
| `AGENTS.md` | Records | 6 (controller) |

---

### Task 1: Colour system

Replaces the colour tokens with two layers, retires every `accent` name, and migrates the nine call sites. The build must stay green, so all of this lands together.

**Files:**
- Modify: `src/app/globals.css` (the `:root` block, the `@theme inline` colour map, the shadow override blocks are left for Task 2, and every rule that reads `--accent*`, `--border*`, `--material-*`)
- Rewrite part of: `src/lib/color-contrast.test.ts` (replace the final `describe("the accent tokens actually shipping", …)` block)
- Create: `src/lib/design-tokens.test.ts`
- Modify: `src/components/PinMark.tsx:28`, `src/components/PhotoPicker.tsx:207`, `src/app/listings/[id]/page.tsx:95`, `src/app/page.tsx:114` and `:235`, `src/app/legal/LegalDocumentPage.tsx:50`, `src/app/signin/page.tsx:87` and `:94`, `src/app/legal/page.tsx:53`, `src/app/listings/[id]/ListingGallery.tsx:46`, `src/app/admin/layout.tsx:41`, `src/app/messages/page.tsx:65`, `src/app/listings/new/ListingForm.tsx:513`, `src/app/messages/[id]/MessageThread.tsx:195`

**Interfaces:**
- Produces CSS custom properties: `--surface`, `--surface-sunken`, `--surface-raised`, `--text`, `--text-secondary`, `--text-tertiary`, `--line`, `--control-line`, `--shadow-color`, `--action`, `--action-contrast`, `--highlight`, `--on-highlight`, `--link`, `--link-decoration`, `--focus`, `--success`, `--success-subtle`, `--danger`, `--danger-subtle`.
- Produces Tailwind utilities (via `@theme inline`): colours `surface`, `surface-sunken`, `surface-raised`, `content`, `secondary`, `tertiary`, `line`, `control-line`, `action`, `action-contrast`, `highlight`, `on-highlight`, `link`, `focus`, `success`, `success-subtle`, `danger`, `danger-subtle` (so `bg-highlight`, `text-on-highlight`, `border-focus`, `bg-action` exist).
- Produces classes: `.badge-highlight` (replaces `.badge-accent`), `.link`.
- Removes: every `--accent*`, `--border`, `--border-strong`, `--material-chrome`, `--material-blur` token; `--color-accent*`, `--color-line-strong` theme entries; `.badge-accent`.

- [ ] **Step 1: Write the failing structure test**

Create `src/lib/design-tokens.test.ts`:

```ts
/**
 * The colour system has two layers, and this is what keeps it that way.
 *
 * Literal colours live only in `--brand-*` primitives. Every semantic token
 * (surface, text, line, action, highlight, focus...) is written in terms of
 * primitives. That is the property that makes swapping in another palette,
 * GMI's if the Institute approves, an edit to one block instead of a hunt
 * through the file. A semantic token with a literal in it would still render
 * correctly, which is exactly why nothing but a test would notice.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CSS_PATH = "src/app/globals.css";
const css = readFileSync(CSS_PATH, "utf8");

/** The first `:root { ... }` block, which is where every token is declared. */
function rootBlock(source: string): string {
  const start = source.indexOf(":root {");
  assert.ok(start >= 0, `${CSS_PATH} has no ":root {" block`);
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${CSS_PATH}: unterminated :root block`);
}

/** Custom-property declarations in a block, comments stripped first. */
function declarations(block: string): Map<string, string> {
  const code = block.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = new Map<string, string>();
  for (const [, name, value] of code.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(name, value.replace(/\s+/g, " ").trim());
  }
  return out;
}

const SEMANTIC_COLOURS = [
  "--surface",
  "--surface-sunken",
  "--surface-raised",
  "--text",
  "--text-secondary",
  "--text-tertiary",
  "--line",
  "--control-line",
  "--shadow-color",
  "--action",
  "--action-contrast",
  "--highlight",
  "--on-highlight",
  "--link",
  "--link-decoration",
  "--focus",
  "--success",
  "--success-subtle",
  "--danger",
  "--danger-subtle",
];

const LITERAL = /oklch\(|rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b/;

const tokens = declarations(rootBlock(css));

describe("the colour tokens", () => {
  it("declares every brand primitive as one plain oklch() literal", () => {
    const brand = [...tokens].filter(([name]) => name.startsWith("--brand-"));
    assert.ok(brand.length >= 10, `expected the primitives block, found ${brand.length}`);
    for (const [name, value] of brand) {
      assert.match(value, /^oklch\([^()]*\)$/, `${name} should be a single oklch() literal, got: ${value}`);
    }
  });

  it("declares every semantic colour token", () => {
    for (const name of SEMANTIC_COLOURS) {
      assert.ok(tokens.has(name), `${CSS_PATH} :root does not declare ${name}`);
    }
  });

  it("writes semantic tokens only in terms of brand primitives", () => {
    for (const name of SEMANTIC_COLOURS) {
      const value = tokens.get(name) ?? "";
      assert.ok(!LITERAL.test(value), `${name} contains a literal colour (${value}); move it into a --brand-* primitive`);
      assert.ok(value.includes("var(--brand-"), `${name} does not reference any --brand-* primitive: ${value}`);
    }
  });
});

describe("the retired vocabulary", () => {
  it("leaves no accent, border or material tokens in the stylesheet", () => {
    for (const retired of ["--accent", "--border", "--material-", "--color-line-strong", ".badge-accent"]) {
      assert.ok(!css.includes(retired), `${CSS_PATH} still mentions ${retired}`);
    }
  });

  it("leaves no accent utilities in any component", () => {
    const files = (readdirSync("src", { recursive: true }) as string[])
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => join("src", f));
    const pattern = /\b(?:text|bg|border|badge|ring|outline|fill|stroke|from|to|via)-accent\b|var\(--accent/;
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.ok(!pattern.test(source), `${file} still uses the retired accent vocabulary`);
    }
  });
});
```

- [ ] **Step 2: Replace the contrast test's palette block**

In `src/lib/color-contrast.test.ts`, add `import { readFileSync } from "node:fs";` below the existing `node:assert/strict` import, then delete the whole final block `describe("the accent tokens actually shipping", () => { ... });` and put this in its place:

```ts
describe("the palette actually shipping", () => {
  // Read from globals.css rather than copied here. A copy was used before and
  // it can drift: retune a primitive, forget the test, and the test keeps
  // certifying the old colour. Reading the file means the numbers checked are
  // the numbers shipped.
  const css = readFileSync("src/app/globals.css", "utf8");
  const brand = new Map<string, string>();
  for (const [, name, value] of css.matchAll(/(--brand-[\w-]+)\s*:\s*(oklch\([^)]*\))\s*;/g)) {
    brand.set(name, value);
  }
  const colour = (name: string): string => {
    const value = brand.get(`--brand-${name}`);
    assert.ok(value, `globals.css declares no --brand-${name}`);
    return value;
  };

  // [what it is, foreground primitive, background primitive, minimum ratio]
  // 4.5 is WCAG AA for text; 3 is AA for non-text UI boundaries (1.4.11).
  const pairs: Array<[string, string, string, number]> = [
    ["light: text on the page", "ink", "paper", 4.5],
    ["light: text on a card", "ink", "card", 4.5],
    ["light: text on a sunken well", "ink", "paper-sunken", 4.5],
    ["light: secondary text on the page", "ink-2", "paper", 4.5],
    ["light: secondary text on a sunken well", "ink-2", "paper-sunken", 4.5],
    ["light: tertiary text on the page", "ink-3", "paper", 4.5],
    ["light: tertiary text on a card", "ink-3", "card", 4.5],
    ["light: tertiary text on a sunken well", "ink-3", "paper-sunken", 4.5],
    ["light: ink on a highlight fill", "ink", "highlight", 4.5],
    ["light: primary button label (yellow on ink)", "highlight", "ink", 4.5],
    ["light: focus ring against the page", "ink", "paper", 3],
    ["light: control border against a card", "ink", "card", 3],
    ["light: success text on its notice", "success-day", "success-subtle-day", 4.5],
    ["light: danger text on its notice", "danger-day", "danger-subtle-day", 4.5],
    ["light: danger text on a card", "danger-day", "card", 4.5],
    ["dark: text on the page", "snow", "night", 4.5],
    ["dark: text on a card", "snow", "night-card", 4.5],
    ["dark: text on a sunken well", "snow", "night-sunken", 4.5],
    ["dark: secondary text on a card", "snow-2", "night-card", 4.5],
    ["dark: tertiary text on the page", "snow-3", "night", 4.5],
    ["dark: tertiary text on a card", "snow-3", "night-card", 4.5],
    ["dark: tertiary text on a sunken well", "snow-3", "night-sunken", 4.5],
    ["dark: primary button label (ink on yellow)", "ink", "highlight", 4.5],
    ["dark: link text on the page", "highlight", "night", 4.5],
    ["dark: link text on a card", "highlight", "night-card", 4.5],
    ["dark: focus ring against the page", "highlight", "night", 3],
    ["dark: control border against a card", "night-control", "night-card", 3],
    ["dark: success text on its notice", "success-night", "success-subtle-night", 4.5],
    ["dark: danger text on its notice", "danger-night", "danger-subtle-night", 4.5],
    ["dark: danger text on a card", "danger-night", "night-card", 4.5],
  ];

  for (const [label, fg, bg, min] of pairs) {
    test(label, () => {
      const ratio = contrastRatio(colour(fg), colour(bg));
      assert.ok(ratio >= min, `${label}: ${ratio.toFixed(2)}:1, needs ${min}:1`);
    });
  }

  test("yellow on the light page fails, which is why it is never text in light mode", () => {
    // Documents the rule in the spec. If this ever passes, the highlight has
    // been darkened enough to read as text, and the rule can be revisited.
    assert.ok(contrastRatio(colour("highlight"), colour("paper")) < 3);
  });
});
```

`meetsAA` is no longer used by this block. If it becomes unused in the file, remove it from the import list so ESLint stays clean.

- [ ] **Step 3: Run both tests and confirm they fail for the right reason**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/lib/design-tokens.test.ts src/lib/color-contrast.test.ts`
Expected: FAIL. `design-tokens`: "expected the primitives block, found 0" and missing `--control-line` etc. `color-contrast`: "globals.css declares no --brand-ink". The first three `describe` blocks of `color-contrast.test.ts` still pass.

- [ ] **Step 4: Replace the `:root` token block**

In `src/app/globals.css`, replace everything from the line `:root {` (the first one, just after the "Design tokens" banner) through the closing `}` that follows `--ease-in: ...;`. **Leave** the two dark shadow override blocks further down (`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --shadow-... } }` and `:root[data-theme="dark"] { --shadow-... }`) untouched; Task 2 deletes them. Also rewrite the banner comment above `:root` so it describes the new system (keep it short: two layers, why, and "light-dark() picks the arm; `color-scheme` decides which"). New block:

```css
:root {
  /* Follow the OS until the theme toggle stores a choice; the two
     [data-theme] rules below override this. Also makes native controls and
     scrollbars follow the theme. */
  color-scheme: light dark;
  /* Native radios and checkboxes. --action is ink in light and yellow in
     dark, which is what a checked control should look like in each. */
  accent-color: var(--action);

  /* ---- Brand primitives -------------------------------------------------
     The only place in this file where a literal colour may appear
     (design-tokens.test.ts enforces it). To re-skin the site, for example
     to GMI's palette if the Institute approves, edit this block and nothing
     else. Values are the approved mockup's colours converted to OKLCH; the
     spec lists the hex each one came from. */
  --brand-paper: oklch(98.5% 0.001 106.4);
  --brand-paper-sunken: oklch(96% 0.002 106.4);
  --brand-card: oklch(100% 0 0);
  --brand-ink: oklch(21% 0.006 285.9);
  --brand-ink-2: oklch(44.2% 0.015 285.8);
  --brand-ink-3: oklch(52% 0.014 285.9);
  --brand-night: oklch(17.9% 0.004 286);
  --brand-night-sunken: oklch(15% 0.004 286);
  --brand-night-card: oklch(21.9% 0.006 285.9);
  --brand-night-line: oklch(37% 0.012 285.8);
  --brand-night-control: oklch(55.2% 0.014 285.9);
  --brand-snow: oklch(96.7% 0.001 286.4);
  --brand-snow-2: oklch(71.2% 0.013 286.1);
  --brand-snow-3: oklch(63.9% 0.012 286.1);
  --brand-highlight: oklch(90.5% 0.166 98.1);
  --brand-success-day: oklch(52% 0.13 155);
  --brand-success-night: oklch(72% 0.14 155);
  --brand-success-subtle-day: oklch(96% 0.04 155);
  --brand-success-subtle-night: oklch(26% 0.05 155);
  --brand-danger-day: oklch(50% 0.19 25);
  --brand-danger-night: oklch(70% 0.17 25);
  --brand-danger-subtle-day: oklch(96% 0.03 25);
  --brand-danger-subtle-night: oklch(27% 0.06 25);

  /* ---- Semantic tokens --------------------------------------------------
     What components use. Each is light-dark(<light arm>, <dark arm>) over
     primitives. The one rule that shapes them: in light mode yellow is only
     ever a fill with ink on it (yellow on paper is about 1.3:1), which is why
     --action, --link and --focus swap sides between the themes. */
  --surface: light-dark(var(--brand-paper), var(--brand-night));
  --surface-sunken: light-dark(var(--brand-paper-sunken), var(--brand-night-sunken));
  --surface-raised: light-dark(var(--brand-card), var(--brand-night-card));

  --text: light-dark(var(--brand-ink), var(--brand-snow));
  --text-secondary: light-dark(var(--brand-ink-2), var(--brand-snow-2));
  --text-tertiary: light-dark(var(--brand-ink-3), var(--brand-snow-3));

  /* --line is the decorative edge of cards, chips, tags and the header.
     --control-line bounds things you operate (fields, secondary buttons,
     the drop zone) and must meet 3:1; in dark mode that needs a lighter
     grey than a card edge wants. */
  --line: light-dark(var(--brand-ink), var(--brand-night-line));
  --control-line: light-dark(var(--brand-ink), var(--brand-night-control));
  --shadow-color: light-dark(var(--brand-ink), var(--brand-night-line));

  --action: light-dark(var(--brand-ink), var(--brand-highlight));
  --action-contrast: light-dark(var(--brand-highlight), var(--brand-ink));
  --highlight: light-dark(var(--brand-highlight), var(--brand-highlight));
  --on-highlight: light-dark(var(--brand-ink), var(--brand-ink));
  --link: light-dark(var(--brand-ink), var(--brand-highlight));
  --link-decoration: light-dark(var(--brand-highlight), var(--brand-highlight));
  --focus: light-dark(var(--brand-ink), var(--brand-highlight));

  --success: light-dark(var(--brand-success-day), var(--brand-success-night));
  --success-subtle: light-dark(var(--brand-success-subtle-day), var(--brand-success-subtle-night));
  --danger: light-dark(var(--brand-danger-day), var(--brand-danger-night));
  --danger-subtle: light-dark(var(--brand-danger-subtle-day), var(--brand-danger-subtle-night));

  /* Shape, depth and motion: unchanged in this task (Task 2 rewrites them). */
  --shadow-sm: 0 1px 2px oklch(21% 0.012 265 / 0.05),
               0 1px 3px oklch(21% 0.012 265 / 0.04);
  --shadow-md: 0 2px 4px oklch(21% 0.012 265 / 0.05),
               0 6px 16px oklch(21% 0.012 265 / 0.07);
  --shadow-lg: 0 4px 8px oklch(21% 0.012 265 / 0.06),
               0 16px 40px oklch(21% 0.012 265 / 0.10);

  --radius-sm: 0.5rem;
  --radius: 0.75rem;
  --radius-lg: 1rem;
  --radius-full: 999px;

  --response-fast: 120ms;
  --response: 200ms;
  --response-slow: 320ms;
  --ease-out: cubic-bezier(0.22, 0.61, 0.36, 1);
  --ease-in: cubic-bezier(0.64, 0, 0.78, 0.39);
}
```

The `--shadow-*` lines keep their literals for now; they are not in `SEMANTIC_COLOURS`, so the structure test does not check them. Task 2 replaces them.

Keep the two lines `:root[data-theme="light"] { color-scheme: light; }` and `:root[data-theme="dark"] { color-scheme: dark; }` and their comment exactly as they are (`src/lib/theme.test.ts` checks them).

- [ ] **Step 5: Replace the colour entries in `@theme inline`**

In the `@theme inline { ... }` block, replace the lines from `--color-surface: var(--surface);` through `--color-danger-subtle: var(--danger-subtle);` with:

```css
  --color-surface: var(--surface);
  --color-surface-sunken: var(--surface-sunken);
  --color-surface-raised: var(--surface-raised);
  --color-content: var(--text);
  --color-secondary: var(--text-secondary);
  --color-tertiary: var(--text-tertiary);
  --color-line: var(--line);
  --color-control-line: var(--control-line);
  --color-action: var(--action);
  --color-action-contrast: var(--action-contrast);
  --color-highlight: var(--highlight);
  --color-on-highlight: var(--on-highlight);
  --color-link: var(--link);
  --color-focus: var(--focus);
  --color-success: var(--success);
  --color-success-subtle: var(--success-subtle);
  --color-danger: var(--danger);
  --color-danger-subtle: var(--danger-subtle);
```

Leave the radius, shadow and font lines in `@theme inline` alone.

- [ ] **Step 6: Migrate every rule in `globals.css` that read a retired token**

Make each of these edits (search for the old text; each is unique unless noted):

1. Every `var(--border-strong)` and every `var(--border)` becomes `var(--line)`, **except** in `.field`, `.btn-secondary` and `.dropzone`, where it becomes `var(--control-line)`. (Run `grep -n "var(--border" src/app/globals.css` before and after; afterwards it must print nothing.)
2. `:focus-visible { outline: 2px solid var(--accent); ...}` → `outline: 2px solid var(--focus);`
3. `.btn-primary`: `background: var(--action); color: var(--action-contrast);` and delete the `@media (hover: hover) { .btn-primary:not(:disabled):hover { background: var(--accent-hover); } }` block (Task 2 adds a lift instead).
4. `.field:focus`: `border-color: var(--control-line); box-shadow: none; outline: 2px solid var(--focus); outline-offset: 2px;` (replace the `outline: none;` line too).
5. `.badge-accent { ... }` → `.badge-highlight { background: var(--highlight); color: var(--on-highlight); }`
6. `.dropzone:has(input:focus-visible)` outline → `var(--focus)`. `.dropzone:hover { border-color: var(--accent); }` → `.dropzone:hover { border-style: solid; }`. `.dropzone-active`: `border-color: var(--control-line); border-style: solid; background: var(--surface-raised);`
7. `.invite-tile:hover { border-color: var(--accent); color: var(--text); }` → `.invite-tile:hover { border-style: solid; color: var(--text); }`
8. `.prose a { color: var(--accent); text-decoration: underline; text-underline-offset: 0.2em; }` → `.prose a { color: var(--link); text-decoration-line: underline; text-decoration-color: var(--link-decoration); text-decoration-thickness: 0.18em; text-underline-offset: 0.18em; }`
9. `.nav-pending::after { ... background: var(--accent); ... }` → `background: var(--action);`
10. `.chrome` becomes solid (the spec removes the translucent header):
    ```css
      .chrome {
        background: var(--surface);
        border-bottom: 2px solid var(--line);
      }
    ```
    and replace its comment with one line: `/* Solid, like paper: the header is printed, not frosted glass. */`
11. Delete the whole `@media (prefers-reduced-transparency: reduce) { ... }` block (nothing translucent is left).
12. In `@media (prefers-contrast: more)`, replace the `:root { ... }` rule with `:root { --text-secondary: var(--text); --text-tertiary: var(--text-secondary); }` and leave the `.card-interactive, .field` line for Task 2 (change its `var(--border-strong)` to `var(--control-line)` now so the build and the test pass).
13. In `.rail` scrollbar rules, `var(--border-strong)` → `var(--line)` (covered by edit 1).

Add the `.link` class inside `@layer components`, directly after `.hint`:

```css
  /* Inline links. Ink with a thick highlighter underline in light mode, so
     yellow is only ever a fill there; plain yellow text in dark mode. */
  .link {
    color: var(--link);
    font-weight: 600;
    text-decoration-line: underline;
    text-decoration-color: var(--link-decoration);
    text-decoration-thickness: 0.18em;
    text-underline-offset: 0.18em;
    transition: text-decoration-thickness var(--response-fast) var(--ease-out);
  }
  @media (hover: hover) {
    .link:hover { text-decoration-thickness: 0.32em; }
  }
```

- [ ] **Step 7: Migrate the component call sites**

Exact replacements (old → new):

| File | Old | New |
|---|---|---|
| `src/components/PinMark.tsx` | `bg-accent text-accent-contrast` | `bg-highlight text-on-highlight` |
| `src/components/PhotoPicker.tsx` | `badge badge-accent` | `badge badge-highlight` |
| `src/app/listings/[id]/page.tsx` | `"badge-accent"` | `"badge-highlight"` |
| `src/app/page.tsx` (~line 114) | `className="font-medium text-accent underline underline-offset-4"` | `className="link"` |
| `src/app/page.tsx` (~line 235) | `badge badge-accent` | `badge badge-highlight` |
| `src/app/legal/LegalDocumentPage.tsx` | `className="text-accent underline underline-offset-2"` | `className="link"` |
| `src/app/signin/page.tsx` (two places) | `className="text-accent underline underline-offset-2"` | `className="link"` |
| `src/app/legal/page.tsx` | `className="text-accent underline underline-offset-2"` | `className="link"` |
| `src/app/listings/[id]/ListingGallery.tsx` | `"border-accent"` | `"border-focus"` |
| `src/app/admin/layout.tsx` | `badge badge-accent` | `badge badge-highlight` |
| `src/app/messages/page.tsx` | `badge badge-accent` | `badge badge-highlight` |
| `src/app/listings/new/ListingForm.tsx` | `bg-accent` | `bg-action` |
| `src/app/messages/[id]/MessageThread.tsx` | `"bg-accent text-[var(--accent-contrast)]"` | `"bg-highlight text-on-highlight"` |

Then run `grep -rnE "accent" src --include=*.tsx`. The only acceptable remaining matches are prose in comments. Any class name containing `accent` is a miss.

- [ ] **Step 8: Run the two tests again**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/lib/design-tokens.test.ts src/lib/color-contrast.test.ts`
Expected: PASS, every case. **If a contrast pair fails**, change only the *lightness* of the foreground or background primitive named in the failure message, in the direction that increases contrast, by the smallest step that passes; re-run; and list every value you changed in your report (the controller records them in the Decision Log). Do not change hue or chroma, and do not lower a minimum.

- [ ] **Step 9: Full verification**

Run each; all must pass:
```bash
npm test
npx tsc --noEmit
npx eslint
npx next build
```
Then confirm the polyfilled theme rules exist in built CSS (Gotcha #47):
```bash
ls .next/static/chunks/*.css
grep -o "lightningcss-dark" .next/static/chunks/*.css | head -3
grep -c "brand-highlight" .next/static/chunks/*.css
```
Expected: at least one CSS path; `lightningcss-dark` found; `brand-highlight` count ≥ 1. If `lightningcss-dark` is absent, `light-dark()` with `var()` arguments was not down-levelled: stop and report it rather than working around it.

- [ ] **Step 10: Commit**

```bash
git add src/app/globals.css src/lib/color-contrast.test.ts src/lib/design-tokens.test.ts src/components/PinMark.tsx src/components/PhotoPicker.tsx "src/app/listings/[id]/page.tsx" src/app/page.tsx src/app/legal/LegalDocumentPage.tsx src/app/signin/page.tsx src/app/legal/page.tsx "src/app/listings/[id]/ListingGallery.tsx" src/app/admin/layout.tsx src/app/messages/page.tsx src/app/listings/new/ListingForm.tsx "src/app/messages/[id]/MessageThread.tsx"
git commit -m "Rebuild the colour tokens on a primitives layer

Ink and highlighter yellow replace violet. Literal colours live only in
--brand-* primitives, so a future palette swap is one block. Contrast is
now read from globals.css instead of a copy that could drift.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 11: Mutation-test the two guards (after the commit)**

1. In `globals.css`, change `--surface: light-dark(var(--brand-paper), var(--brand-night));` to `--surface: light-dark(oklch(98% 0 0), var(--brand-night));`. Run the design-tokens test. Expected: FAIL naming `--surface`. Revert with `git checkout src/app/globals.css`.
2. Change `--brand-ink-3: oklch(52% ...)` to `oklch(70% 0.014 285.9)`. Run the contrast test. Expected: FAIL on the light tertiary pairs. Revert with `git checkout src/app/globals.css`.
3. In `src/app/legal/page.tsx`, change `className="link"` to `className="text-accent"`. Run the design-tokens test. Expected: FAIL naming that file. Revert with `git checkout src/app/legal/page.tsx`.

Run `git status --short` afterwards: only `README.md` and `docs/case-study.md` may show as modified.

**Report:** the four verification outputs (last lines), the built-CSS grep output, any primitive values changed in Step 8, and the three mutation results.

---

### Task 2: Shape, depth and components

Square corners, hard offset shadows, the press-into-the-board interaction, and the shared classes rebuilt on them.

**Files:**
- Modify: `src/app/globals.css` (the shape/shadow tokens in `:root`, both dark shadow override blocks, `@theme inline` radius lines, the Interaction section, the Accessibility signals section, and the component classes listed below)
- Modify: `src/app/loading.tsx:13`, `src/app/listings/[id]/loading.tsx:11`, `src/app/listings/new/ListingForm.tsx:511`, `src/app/listings/[id]/ListingGallery.tsx:44`

**Interfaces:**
- Consumes (Task 1): `--line`, `--control-line`, `--shadow-color`, `--action`, `--action-contrast`, `--highlight`, `--on-highlight`, `--focus`, `--surface*`, `--text*`, `.badge-highlight`.
- Produces: `--radius-sm: 2px`, `--radius: 3px`, `--radius-lg: 3px`; `--shadow-sm: 2px 2px 0 var(--shadow-color)`, `--shadow-md: 3px 3px 0 ...`, `--shadow-lg: 4px 4px 0 ...`; Tailwind `rounded-md` resolves to 3px.

- [ ] **Step 1: Replace the shape and shadow tokens**

In the `:root` block, replace the three `--shadow-*` declarations and the four `--radius*` declarations (and the "Task 2 rewrites them" comment) with:

```css
  /* Shape. One radius everywhere, a smaller one for tags. No pills: a
     printed card has corners. */
  --radius-sm: 2px;
  --radius: 3px;
  --radius-lg: 3px;

  /* Depth is a hard offset, never a blur: cards are pinned paper, and the
     shadow is where they would land if pressed flat. Colour comes from
     --shadow-color, which is ink in light and a lifted grey in dark (a black
     shadow would vanish on near-black). */
  --shadow-sm: 2px 2px 0 var(--shadow-color);
  --shadow-md: 3px 3px 0 var(--shadow-color);
  --shadow-lg: 4px 4px 0 var(--shadow-color);
  --shadow-none: 0 0 0 var(--shadow-color);
```

`--radius-full` is removed. Then delete **both** dark shadow override blocks (`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --shadow-... } }` and `:root[data-theme="dark"] { --shadow-... }`) together with the comment above them that begins "Shadows cannot go through light-dark()". Do **not** delete `:root[data-theme="dark"] { color-scheme: dark; }`.

In `@theme inline`, replace the radius lines with:
```css
  --radius-sm: var(--radius-sm);
  --radius-DEFAULT: var(--radius);
  --radius-md: var(--radius);
  --radius-lg: var(--radius-lg);
```

- [ ] **Step 2: Replace the Interaction section's press and lift rules**

Replace `.pressable:active { transform: scale(0.97); }` with:
```css
.pressable:active {
  transform: translate(1px, 1px);
}
```
Replace the whole `.card-interactive` block (its transition, the hover media query, and the `:active` rule) with:
```css
/* Interactive cards lift toward the pointer and press into the board when
   tapped: the shadow grows as the card rises and disappears as it is pushed
   flat, so the motion and the depth say the same thing. */
.card-interactive {
  transition:
    transform var(--response-fast) var(--ease-out),
    box-shadow var(--response-fast) var(--ease-out);
}
@media (hover: hover) {
  .card-interactive:hover {
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-lg);
  }
}
.card-interactive:active {
  transform: translate(3px, 3px);
  box-shadow: var(--shadow-none);
}
```
In the `.rail` fine-pointer rules, `border-radius: var(--radius-full);` → `border-radius: var(--radius-sm);`. In `.nav-pending::after`, delete the `border-radius: var(--radius-full);` line.

- [ ] **Step 3: Replace the Accessibility signals rules**

Inside `@media (prefers-reduced-motion: reduce)`, replace the rule listing `.pressable:active, .card-interactive:hover, .card-interactive:active` with:
```css
  /* The state still changes (shadow, colour); nothing travels. */
  .pressable:active,
  .btn:hover,
  .btn:active,
  .chip:active,
  .card-interactive:hover,
  .card-interactive:active {
    transform: none;
  }
```
Keep the `.pressable:active { opacity: 0.7; }` line.

Replace the whole `@media (prefers-contrast: more)` block with:
```css
@media (prefers-contrast: more) {
  :root {
    --text-secondary: var(--text);
    --text-tertiary: var(--text-secondary);
  }
  .btn-primary, .btn-secondary, .field, .chip, .card, .badge-outline,
  .notice, .dropzone, .invite-tile {
    border-width: 2px;
  }
}
```

- [ ] **Step 4: Rebuild the component classes**

Inside `@layer components`, replace these rules in place (keep every other rule and every comment not named here). Keep each existing explanatory comment above a class unless it describes behaviour this step removes (scale presses, rounded pills, blur); rewrite those sentences to match.

`.btn` through `.btn-sm`:
```css
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    /* Comfortably past the 44px touch target on the primary sizes. */
    min-height: 2.75rem;
    padding: 0.625rem 1.125rem;
    border: 1.5px solid transparent;
    border-radius: var(--radius);
    font-size: 0.9375rem;
    font-weight: 800;
    letter-spacing: 0;
    /* A label that wraps makes a two-line button; let the row wrap instead. */
    white-space: nowrap;
    cursor: pointer;
    transition:
      transform var(--response-fast) var(--ease-out),
      box-shadow var(--response-fast) var(--ease-out),
      background-color var(--response-fast) var(--ease-out),
      opacity var(--response-fast) var(--ease-out);
    touch-action: manipulation;
  }
  .btn:disabled, .btn[aria-disabled="true"] {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: var(--shadow-none);
  }

  /* Primary and secondary sit proud of the page on a 2px offset, lift a
     pixel under the pointer, and press flat on pointer-down. */
  .btn-primary,
  .btn-secondary {
    box-shadow: var(--shadow-sm);
  }
  @media (hover: hover) {
    .btn-primary:not(:disabled):hover,
    .btn-secondary:not(:disabled):hover {
      transform: translate(-1px, -1px);
      box-shadow: var(--shadow-md);
    }
  }
  .btn-primary:not(:disabled):active,
  .btn-secondary:not(:disabled):active {
    transform: translate(2px, 2px);
    box-shadow: var(--shadow-none);
  }

  .btn-primary {
    background: var(--action);
    color: var(--action-contrast);
    border-color: var(--line);
  }

  .btn-secondary {
    background: var(--surface-raised);
    color: var(--text);
    border-color: var(--control-line);
  }

  .btn-ghost {
    background: transparent;
    color: var(--text-secondary);
    min-height: 2.25rem;
    padding: 0.375rem 0.625rem;
    font-weight: 600;
  }
  .btn-ghost:active { background: var(--surface-sunken); }
  @media (hover: hover) {
    .btn-ghost:hover { color: var(--text); background: var(--surface-sunken); }
  }

  .btn-sm { min-height: 2.25rem; padding: 0.375rem 0.75rem; font-size: 0.875rem; }
```

`.field`, `.field::placeholder`, `.field:focus`, `.label`:
```css
  .field {
    width: 100%;
    background: var(--surface-raised);
    color: var(--text);
    border: 1.5px solid var(--control-line);
    border-radius: var(--radius);
    padding: 0.625rem 0.875rem;
    font-size: 0.9375rem;
    min-height: 2.75rem;
    transition: outline-color var(--response-fast) var(--ease-out);
  }
  .field::placeholder { color: var(--text-tertiary); }
  .field:focus {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .label {
    display: block;
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--text);
  }
```

`.badge` and variants:
```css
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.4375rem;
    border: 1.5px solid transparent;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }
  .badge-neutral { background: var(--surface-sunken); color: var(--text-secondary); }
  .badge-highlight { background: var(--highlight); color: var(--on-highlight); }
  /* Raised fill so it stays legible when it sits on a photograph. */
  .badge-outline {
    background: var(--surface-raised);
    border-color: var(--line);
    color: var(--text);
  }
```

`.chip` and `.chip-selected` (replace both, including their hover media queries):
```css
  .chip {
    display: inline-flex;
    align-items: center;
    min-height: 2.125rem;
    padding: 0.375rem 0.875rem;
    border: 1.5px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface-raised);
    color: var(--text);
    font-size: 0.875rem;
    font-weight: 600;
    white-space: nowrap;
    transition:
      transform var(--response-fast) var(--ease-out),
      background-color var(--response-fast) var(--ease-out);
    touch-action: manipulation;
  }
  .chip:active { transform: translate(1px, 1px); }
  @media (hover: hover) {
    .chip:hover { background: var(--surface-sunken); }
  }
  /* Selected is a highlighter fill: the current filter is marked the way you
     would mark it on paper. */
  .chip-selected,
  .chip-selected:hover {
    background: var(--highlight);
    color: var(--on-highlight);
  }
```

`.card`:
```css
  .card {
    background: var(--surface-raised);
    border: 1.5px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-md);
  }
```

`.notice` and variants:
```css
  .notice {
    display: flex;
    gap: 0.625rem;
    padding: 0.75rem 1rem;
    border: 1.5px solid currentColor;
    border-radius: var(--radius);
    font-size: 0.875rem;
    line-height: 1.5;
  }
  .notice-success { background: var(--success-subtle); color: var(--success); }
  .notice-danger { background: var(--danger-subtle); color: var(--danger); }
  .notice-neutral {
    background: var(--surface-sunken);
    color: var(--text-secondary);
    border-color: var(--line);
  }
```

In `.dropzone`: `border: 1.5px dashed var(--control-line);`, `border-radius: var(--radius);`, and its `transition:` becomes `transition: background-color var(--response-fast) var(--ease-out);`.
In `.invite-tile`: `border: 1.5px dashed var(--line);`, `border-radius: var(--radius);`.
In `.prose`: add `max-width: 65ch;` and set `line-height: 1.6;`.

- [ ] **Step 5: Square the four pill call sites**

| File | Old | New |
|---|---|---|
| `src/app/loading.tsx` | `rounded-full` | `rounded` |
| `src/app/listings/[id]/loading.tsx` | `rounded-full` | `rounded-sm` |
| `src/app/listings/new/ListingForm.tsx` | `rounded-full` | `rounded-sm` |
| `src/app/listings/[id]/ListingGallery.tsx` | `rounded-md border` | `rounded-sm border-[1.5px]` |

Run `grep -rn "rounded-full\|radius-full" src`. Expected: nothing.

- [ ] **Step 6: Full verification**

```bash
npm test
npx tsc --noEmit
npx eslint
npx next build
ls .next/static/chunks/*.css
grep -o "translate(2px, *2px)\|translate(2px,2px)" .next/static/chunks/*.css | head -2
grep -c "radius-full" .next/static/chunks/*.css
```
Expected: all green; the translate rule found; `radius-full` count 0 in every file.

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css src/app/loading.tsx "src/app/listings/[id]/loading.tsx" src/app/listings/new/ListingForm.tsx "src/app/listings/[id]/ListingGallery.tsx"
git commit -m "Square corners, offset shadows, press-into-the-board interaction

Components keep their class names, so every page picks this up without
edits. Reduced motion keeps the state change and drops the movement.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**Report:** verification output tails and the two grep results.

---

### Task 3: Typography (Archivo)

**Files:**
- Modify: `src/app/layout.tsx:1-27` and the `<html className=...>`
- Modify: `src/app/globals.css` (`@theme inline` font lines, `body`, the heading-family rule, the type scale, price classes, `.prose` headings)

**Interfaces:**
- Consumes: nothing from Tasks 1 and 2 beyond an intact `globals.css`.
- Produces: CSS variable `--font-archivo` on `<html>`; Tailwind `font-sans` and `font-display` both resolve to Archivo.

- [ ] **Step 1: Confirm Archivo is available to `next/font` in this Next version**

Run: `grep -c "Archivo" node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`
Expected: a count ≥ 1. Then `grep -o '"Archivo":{[^}]*}' node_modules/next/dist/compiled/@next/font/dist/google/font-data.json | head -c 400` and confirm the weights include a variable range (`"100 900"` or similar). If the file path differs, find it with `find node_modules/next -name font-data.json`.

- [ ] **Step 2: Swap the font in `layout.tsx`**

Replace the `import { Inter, Space_Grotesk } from "next/font/google";` line with `import { Archivo } from "next/font/google";`. Replace the comment and both font constants with:

```tsx
/**
 * One family, loaded through next/font so it is self-hosted at build time.
 * The CSP is `font-src 'self' data:`, so a <link> to fonts.googleapis.com
 * would be blocked (Known Gotchas #46).
 *
 * Archivo carries everything: 900 for headings and prices, 800 for buttons,
 * 600 for card titles, 400-500 for body. Its heavy weights are poster-like,
 * which is the notice-board look; its regular weight is a plain body face.
 * One family means one download and nothing to mismatch.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});
```

In `<html className=...>`, replace `` `${inter.variable} ${spaceGrotesk.variable} h-full antialiased` `` with `` `${archivo.variable} h-full antialiased` ``.

- [ ] **Step 3: Point the stylesheet at Archivo and retune the scale**

In `@theme inline`: `--font-sans: var(--font-archivo);` and `--font-display: var(--font-archivo);`.

In `body`: `font-family: var(--font-archivo), system-ui, -apple-system, sans-serif;` (keep the Gotcha #36 comment).

Replace the heading-family rule (`h1, h2, h3, .text-display, .text-price, .text-price-lg { font-family: ... }`) and its comment with:
```css
/* One family, so headings need no family of their own; weight does the
   work that a second typeface used to. */
```
(i.e. delete the rule; `body` already sets the family.)

Replace the type-scale rules with these values (keep the existing comments above them, updating any sentence that names Space Grotesk or Inter):

```css
h1, .text-display {
  font-size: clamp(1.75rem, 1.4rem + 1.6vw, 2.5rem);
  line-height: 1.05;
  letter-spacing: -0.03em;
  font-weight: 900;
}

h2 {
  font-size: clamp(1.25rem, 1.1rem + 0.7vw, 1.5rem);
  line-height: 1.15;
  letter-spacing: -0.02em;
  font-weight: 800;
}

h3 {
  font-size: 1.0625rem;
  line-height: 1.3;
  letter-spacing: -0.01em;
  font-weight: 700;
}
```
`small, .text-fine` unchanged.

`.text-price`: `font-weight: 900; letter-spacing: -0.01em;` (size, line-height, colour, tabular unchanged).
`.text-price-unit`: `font-weight: 600;`.
`.text-price-lg`: `font-size: 1.625rem; line-height: 1.1; letter-spacing: -0.02em; font-weight: 900;`.
`.prose h2`: `font-weight: 800; letter-spacing: -0.015em;`. `.prose h3`: `font-weight: 700;`. `.prose strong`: `font-weight: 700;`.

Then `grep -n "font-weight: 5[0-9][0-9]\|font-weight: 6[1-9][0-9]\|space-grotesk\|font-inter" src/app/globals.css`. Expected: nothing (the old in-between weights like 550, 560 and 640 are gone, and no old family is referenced).

- [ ] **Step 4: Full verification plus the font checks**

```bash
npm test
npx tsc --noEmit
npx eslint
npx next build
ls .next/static/media/*.woff2 | head
grep -rl "fonts.gstatic.com\|fonts.googleapis.com" .next/static .next/server --include=*.js --include=*.css --include=*.html 2>/dev/null | grep -v "\.map$" | head
grep -rn "Space_Grotesk\|Inter\b\|font-space-grotesk\|font-inter" src --include=*.tsx --include=*.ts --include=*.css | grep -v test
```
Expected: green; at least one `.woff2`; the gstatic grep prints nothing (if it prints a file, open it and check what matched before concluding anything, since source maps are excluded but other bundles may mention the URL in a comment); the last grep prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "Set everything in Archivo

Replaces Space Grotesk and Inter with one family; weight carries the
hierarchy. Self-hosted through next/font as before.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**Report:** verification tails, the `.woff2` listing, and the output of both greps.

---

### Task 4: Icons (Phosphor)

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/components/icon-style.ts`
- Modify: `src/components/ThemeToggle.tsx` (the two `<svg>` elements), `src/components/NoPhoto.tsx` (the `<svg>`), `src/components/PhotoPicker.tsx:165-177` (the `<svg>`)

**Interfaces:**
- Produces: `ICON_WEIGHT` (type `IconWeight`, value `"bold"`) exported from `src/components/icon-style.ts`.

- [ ] **Step 1: Record the bundle size, then install and inspect**

First run `npx next build` and note the "First Load JS" figure for `/` in the route table (the baseline for Step 6). Then:

```bash
npm install @phosphor-icons/react@^2.1.10
```
Read the install output for any `npm warn allow-scripts` line (Gotcha #11). If one names a Phosphor package, stop and report it; do not approve scripts yourself.

Then establish the real names rather than guessing, because 2.1.x added `…Icon`-suffixed exports:
```bash
grep -o "export { [A-Za-z]*Sun[A-Za-z]* \|SunIcon\b" node_modules/@phosphor-icons/react/dist/index.d.ts | sort -u | head
grep -oE "\b(SunIcon|MoonIcon|ImageIcon|UploadSimpleIcon|IconWeight)\b" node_modules/@phosphor-icons/react/dist/index.d.ts | sort -u
grep -oE "\b(ImageIcon|IconWeight)\b" node_modules/@phosphor-icons/react/dist/ssr/index.d.ts | sort -u
grep -n "phosphor" node_modules/next/dist/server/config.js | head -3
```
Use the `…Icon` names if they exist (they avoid colliding with `next/image`'s `Image`); otherwise the bare names. The last grep tells you whether Next already optimises Phosphor imports; if it prints nothing, report that (the controller decides whether to add `experimental.optimizePackageImports`).

- [ ] **Step 2: Create the style module**

`src/components/icon-style.ts`:
```ts
import type { IconWeight } from "@phosphor-icons/react";

/**
 * The one icon weight on the site. Bold sits with the 1.5px borders and
 * heavy type of the notice-board style; a lighter weight looks like it came
 * from a different product. Set here so no call site picks its own.
 *
 * Icons come from Phosphor rather than hand-drawn paths. The exception is
 * PinMark, which is the logo, not an icon.
 */
export const ICON_WEIGHT: IconWeight = "bold";
```
(If Step 1 showed `IconWeight` is not exported from the package root, import it from wherever the `.d.ts` grep found it.)

- [ ] **Step 3: Replace the theme toggle's SVGs**

In `src/components/ThemeToggle.tsx` (a client component, so import from the package root):
```tsx
import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { ICON_WEIGHT } from "@/components/icon-style";
```
Replace the two `<svg>...</svg>` elements with:
```tsx
      <SunIcon
        weight={ICON_WEIGHT}
        aria-hidden="true"
        className="theme-icon-sun h-[1.125rem] w-[1.125rem]"
      />
      <MoonIcon
        weight={ICON_WEIGHT}
        aria-hidden="true"
        className="theme-icon-moon h-[1.125rem] w-[1.125rem]"
      />
```
The `theme-icon-sun` / `theme-icon-moon` classes are load-bearing (CSS picks which one shows); keep them exactly.

- [ ] **Step 4: Replace NoPhoto's SVG**

`NoPhoto.tsx` has no `"use client"`, so it renders on the server: import from the `ssr` entry.
```tsx
import { ImageIcon } from "@phosphor-icons/react/ssr";
import { ICON_WEIGHT } from "@/components/icon-style";
```
Replace the `<svg>...</svg>` with:
```tsx
      <ImageIcon
        weight={ICON_WEIGHT}
        aria-hidden="true"
        className={compact ? "h-5 w-5" : "h-6 w-6"}
      />
```

- [ ] **Step 5: Replace PhotoPicker's SVG**

`PhotoPicker.tsx` is a client component; import `UploadSimpleIcon` from `"@phosphor-icons/react"` and `ICON_WEIGHT`. Replace the `<svg ...>` block at ~lines 165-177 with a `<UploadSimpleIcon weight={ICON_WEIGHT} aria-hidden="true" className="..." />`, **copying the `className` from the `<svg>` you are replacing** so its size and colour do not change.

Then: `grep -n "<svg" src/components/ThemeToggle.tsx src/components/NoPhoto.tsx src/components/PhotoPicker.tsx`. Expected: nothing.

- [ ] **Step 6: Full verification**

```bash
npm test
npx tsc --noEmit
npx eslint
npx next build
```
Expected: green. In the `next build` route table, compare the "First Load JS" of `/` with the baseline from Step 1. Report both numbers; a jump over ~30 kB means the whole icon set was bundled.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/components/icon-style.ts src/components/ThemeToggle.tsx src/components/NoPhoto.tsx src/components/PhotoPicker.tsx
git commit -m "Replace hand-drawn icons with Phosphor, one weight

The pushpin mark stays hand-drawn; it is the logo, not an icon.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**Report:** install output (any warnings), the export names found, the Next optimisation grep, First Load JS before/after, verification tails.

---

### Task 5: Brand mark

The pushpin keeps its shape; it moves to a yellow square with an ink pin and square-ish corners, in both the header mark and the favicon.

**Files:**
- Modify: `src/components/PinMark.tsx` (class list and the proportion comment)
- Modify: `src/app/icon.svg`
- Modify: `src/app/icon.test.ts` (the baked-colour test)

**Interfaces:**
- Consumes (Task 1): Tailwind colours `highlight`, `on-highlight` (already applied to PinMark in Task 1).
- Produces: favicon colours `#fde047` (fill) and `#18181b` (glyph), which are `--brand-highlight` and `--brand-ink`.

- [ ] **Step 1: Update the failing test first**

In `src/app/icon.test.ts`, replace the `it("bakes the accent colour the header mark uses", ...)` case with:
```ts
  it("bakes the highlight and ink colours the header mark uses", () => {
    // A favicon cannot read the page's CSS custom properties, so these values
    // are copies and copies drift. #fde047 is the highlight primitive and
    // #18181b the ink primitive in globals.css; if either changes, this fails
    // and names the file that has to change with it.
    assert.match(icon, /<rect width="32" height="32" rx="3" fill="#fde047"\/>/);
    assert.match(icon, /<g fill="#18181b"/);
  });
```
Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/app/icon.test.ts`
Expected: FAIL on the new case only.

- [ ] **Step 2: Update `icon.svg`**

Change `<rect width="32" height="32" rx="7" fill="#7544cd"/>` to `<rect width="32" height="32" rx="3" fill="#fde047"/>` and `<g fill="#fcfcfc" transform="translate(4 4)">` to `<g fill="#18181b" transform="translate(4 4)">`. Rewrite the comment so it says: `#fde047` is `oklch(90.5% 0.166 98.1)`, the highlight primitive, and `#18181b` is the ink primitive, both baked because a favicon cannot read CSS; the corner is `rx=3` on 32 units (9.375%), matched by PinMark's `rounded-[9.375%]`; keep the existing warnings about double hyphens and about the duplicated glyph. **The comment must not contain two consecutive hyphens anywhere** (write "the highlight primitive", never its CSS name).

Validate the file parses:
```bash
python3 -c "import xml.dom.minidom; xml.dom.minidom.parse('src/app/icon.svg'); print('ok')"
```
Expected: `ok`.

- [ ] **Step 3: Update `PinMark.tsx`**

In the class list, `rounded-[22%]` → `rounded-[9.375%]` (the `bg-highlight text-on-highlight` from Task 1 stays). Update the comment's proportion paragraph: the corner is now `rx="3"` on 32 units, 9.375%, and the reason a percentage rather than a token radius is used still holds (a token radius does not scale with the box). Update the first line to "a pushpin on a highlighter-yellow square".

- [ ] **Step 4: Verify**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/app/icon.test.ts
npm test
npx tsc --noEmit
npx eslint
npx next build
```
Expected: all green.

- [ ] **Step 5: Commit, then mutation-test**

```bash
git add src/components/PinMark.tsx src/app/icon.svg src/app/icon.test.ts
git commit -m "Move the pushpin mark onto the highlighter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
Then: add the text ` highlight--primitive ` inside the SVG comment, run `icon.test.ts` (expected FAIL on the double-hyphen case), and revert with `git checkout src/app/icon.svg`. Confirm `git status --short` shows only `README.md` and `docs/case-study.md`.

**Report:** test outputs, the XML parse result, the mutation result.

---

### Task 6: Phase verification and records (controller, not a subagent)

- [ ] Run `npm test`, `npx tsc --noEmit`, `npx eslint`, `npx next build` on the branch tip.
- [ ] Start `npx next start` (port 3000) and capture signed-out pages with headless Chrome at 375 and 1280 wide, light and dark. Force the theme by setting `localStorage` is not possible headlessly, so capture dark by running Chrome with `--force-dark-mode` (the site follows the OS with no stored choice) and light without it. Pages: `/`, a listing detail (pick an id from the dev database), `/signin`, `/legal`, `/legal/terms`, a 404. Review every image against the reference and the pre-flight items that apply to Phase 1: colour lock, shape lock, button and form contrast, no wrapped button labels, yellow never used as text on light.
- [ ] Update `AGENTS.md`: Current State (Phase 1 of the overhaul merged or in review), Decision Log entries for (a) the two-layer palette and "independent now, GMI-swappable later", (b) `--control-line` existing because the decorative dark line fails 3:1, (c) CSS-only motion as a recorded taste-skill exception, (d) any primitive value the implementer changed in Task 1 Step 8, and (e) `--brand-danger-day` moving from 55% to 50% lightness to pass AA on its notice; Next Steps (Phase 2 next). Add a Known Gotcha only if something cost real time.
- [ ] Give the builder the signed-in walk list for this phase: inbox, a thread, `/listings/mine`, `/listings/new` with type SERVICE and category Food & Drink (every conditional control), the edit page, `/admin`, in both themes.
- [ ] Open the PR with the screenshots summarised, the walk list, and the pre-flight results.
