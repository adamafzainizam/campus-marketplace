# Light/dark toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A button in the site header that switches between light and dark, remembers the choice, and leaves anyone who never presses it following their operating system exactly as today.

**Architecture:** `localStorage` holds `"light"`, `"dark"`, or nothing; a synchronous inline script in `<head>` stamps `data-theme` on `<html>` before the first paint; CSS turns that attribute into a `color-scheme`, and every colour token is a `light-dark()` pair that resolves against it. The button itself holds no JavaScript state — it renders both icons and both labels and lets CSS pick, so the server's markup is identical every render.

**Tech Stack:** Next.js 16 App Router, Tailwind v4, CSS `light-dark()` and `color-scheme`, `node:test` with Node's native TypeScript type-stripping.

## Global Constraints

From `docs/superpowers/specs/2026-08-16-theme-toggle-design.md` and `AGENTS.md`. Every task's requirements implicitly include this section.

- **Zero new dependencies.** No theme library, no icon package. Icons are inline SVG.
- **Do not touch `src/lib/security-headers.ts`.** Three production outages have come from that policy. The inline script this plan adds is already permitted by `script-src 'self' 'unsafe-inline'` — verified. If you believe the CSP needs changing, stop and report instead.
- **Do not touch the conversation thread page** (`src/app/messages/[id]/`). Its height contract has broken twice from changes made elsewhere (Gotchas #33, #37).
- **`color-contrast.test.ts` keeps its hardcoded colour values.** It asserts a contrast property of specific pairs, not that the stylesheet contains them. Do not rewire it to read `globals.css`; that is out of scope.
- **Spacing scale:** only Tailwind steps `1, 2, 3, 4, 6, 10, 16` between groups; sub-step optical values inside a component (rule at `src/app/globals.css:149-169`).
- **Test-file import rule (Gotchas #21/#23):** files run by `npm test` use **relative** imports with **explicit `.ts` extensions**, at any depth. The `@/` alias does not resolve there. `.tsx` components bundled by Next use `@/` as normal.
- **No CSS fallbacks for `light-dark()`.** This codebase already ships `oklch()` and `:has()` with no fallbacks and therefore already requires a 2023+ browser; `light-dark()` is Baseline 2024 (Chrome 123, Safari 17.5, Firefox 120). Adding a fallback pair for this one function would be inconsistent and would restore the duplication the conversion exists to remove. Recorded as a decision, not an oversight.
- **Verification:** `npm test` (390 passing before this plan), `npx tsc --noEmit`, `npx eslint`, `npx next build`.
- **Built CSS lives at `.next/static/chunks/*.css`** under this project's Next 16 / Turbopack build — *not* `.next/static/css/`. Grepping the wrong path returns nothing, which looks identical to a class that failed to emit (Gotcha #47).
- **Commit style:** sentence-case imperative summary, no `feat:`/`fix:` prefix, body explaining *why*, trailer:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```
- **Branch:** `feature/theme-toggle`, already checked out with the spec committed at `05809d2`. Do not branch again, do not commit to `main`.
- **Commit before mutation-testing anything** (Gotcha #50 — hit three times now, once by an agent that had the warning in context).

---

### Task 1: `src/lib/theme.ts` — the rules and the script

**Files:**
- Create: `src/lib/theme.ts`
- Create: `src/lib/theme.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export type Theme = "light" | "dark";
  export const THEME_STORAGE_KEY = "theme";
  export const THEME_ATTRIBUTE = "data-theme";
  export function nextTheme(current: Theme): Theme;
  export function isTheme(value: unknown): value is Theme;
  export const THEME_INIT_SCRIPT: string;
  ```
  Task 3 injects `THEME_INIT_SCRIPT`; Task 4 uses the rest.

**Why the script is a string in a tested module:** the script and the button must agree on a storage key and an attribute name, and they live in different files — one inside a `dangerouslySetInnerHTML`, where nothing type-checks it. Exporting it from the same module that exports the constants means a test can assert they match.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/theme.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  THEME_ATTRIBUTE,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  isTheme,
  nextTheme,
} from "./theme.ts";

describe("nextTheme", () => {
  it("alternates", () => {
    assert.equal(nextTheme("light"), "dark");
    assert.equal(nextTheme("dark"), "light");
  });

  it("returns to where it started after two presses", () => {
    assert.equal(nextTheme(nextTheme("light")), "light");
  });
});

describe("isTheme", () => {
  it("accepts the two themes", () => {
    assert.ok(isTheme("light"));
    assert.ok(isTheme("dark"));
  });

  // localStorage is user-writable and survives across deploys, so a value
  // from an older version of this site — or from a person editing it — must
  // not reach the attribute.
  it("rejects anything else", () => {
    for (const value of ["system", "", "DARK", null, undefined, 0, {}]) {
      assert.ok(!isTheme(value), `accepted ${JSON.stringify(value)}`);
    }
  });
});

describe("the init script", () => {
  // The script runs as text inside the document; nothing type-checks it, so
  // these assertions are the only thing keeping it agreeing with the module
  // the button imports.
  it("uses the same storage key the button writes", () => {
    assert.ok(THEME_INIT_SCRIPT.includes(JSON.stringify(THEME_STORAGE_KEY)));
  });

  it("sets the same attribute the stylesheet reads", () => {
    assert.ok(THEME_INIT_SCRIPT.includes(JSON.stringify(THEME_ATTRIBUTE)));
  });

  // A throwing script in <head> blocks rendering. Private-mode Safari has
  // historically thrown on localStorage access, and the cost of being wrong
  // about that is a blank page rather than a wrong colour.
  it("cannot throw its way into a blank page", () => {
    assert.match(THEME_INIT_SCRIPT, /try\s*\{/);
    assert.match(THEME_INIT_SCRIPT, /catch/);
  });

  // It ships inside <script dangerouslySetInnerHTML>. A literal </script>
  // would close the tag early; there is no reason for one to appear.
  it("contains nothing that would close its own tag", () => {
    assert.ok(!/<\/script/i.test(THEME_INIT_SCRIPT));
  });

  it("is one expression with no imports, since it runs before any bundle", () => {
    assert.ok(!THEME_INIT_SCRIPT.includes("import"));
    assert.ok(!THEME_INIT_SCRIPT.includes("require("));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test 2>&1 | tail -20`
Expected: FAIL — `Cannot find module './theme.ts'`.

- [ ] **Step 3: Implement the module**

Create `src/lib/theme.ts`:

```ts
/**
 * Choosing and remembering a colour theme.
 *
 * No I/O and no React: this module is reached by a test, so its imports would
 * have to be relative with explicit extensions (Gotchas #21/#23) — it happens
 * to need none.
 *
 * The site follows the operating system until somebody presses the button.
 * That is why "system" is not a value here: it is the *absence* of a stored
 * value, handled by CSS rather than by code, so a reader who never touches the
 * button gets exactly the behaviour the site had before this existed.
 */

export type Theme = "light" | "dark";

/** Read by the init script and written by the button. */
export const THEME_STORAGE_KEY = "theme";

/** Stamped on <html>; the stylesheet turns it into a `color-scheme`. */
export const THEME_ATTRIBUTE = "data-theme";

export function nextTheme(current: Theme): Theme {
  return current === "light" ? "dark" : "light";
}

/**
 * Whether a value off `localStorage` is one this site understands.
 *
 * Storage is user-writable and outlives deployments, so a value written by an
 * older version of the site — or by a person poking at devtools — must never
 * reach the attribute. Anything unrecognised means "follow the system".
 */
export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Runs synchronously in <head>, before the first paint.
 *
 * It has to be inline and blocking: anything deferred paints the wrong theme
 * first and corrects it, which is a visible flash on every single page load.
 *
 * Wrapped in try/catch because reading `localStorage` can throw outright in
 * some privacy modes, and a script that throws in <head> is a blank page
 * rather than a wrong colour. Failing silently here is correct — the fallback
 * is the system theme, which is a perfectly good answer.
 *
 * Built from the constants above rather than written out, so the key and the
 * attribute cannot drift from what the button uses; theme.test.ts asserts it.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute(${JSON.stringify(
  THEME_ATTRIBUTE,
)},t)}}catch(e){}`;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test 2>&1 | tail -20`
Expected: PASS, suite up by 9 to **399**.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit && npx eslint
git add src/lib/theme.ts src/lib/theme.test.ts
git commit -m "$(cat <<'EOF'
Add the theme rules, and the script that applies them before paint

The init script has to be inline text in <head> or the page paints the wrong
colours and corrects them on every load, and text in a
dangerouslySetInnerHTML is type-checked by nothing. Building it from the same
constants the button imports, and asserting in a test that it mentions them,
is what stops the two drifting.

"system" is deliberately not a value: it is the absence of a stored one, so
anyone who never presses the button keeps today's behaviour exactly.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Convert the tokens to `light-dark()`

**Files:**
- Modify: `src/app/globals.css:14-106` (the `:root` block and the dark `@media` block) and `:722-736` (the shimmer's dark `@media` block)

**Interfaces:**
- Consumes: nothing from Task 1 — this task is pure CSS and can be reviewed on its own.
- Produces: a stylesheet where `:root[data-theme="light"]` and `:root[data-theme="dark"]` decide the palette, which Tasks 3 and 4 rely on.

**The mechanism.** `color-scheme: light dark` means "this element is happy either way, follow the OS". `light-dark(a, b)` then resolves to `a` or `b` according to whichever the element computed. So setting `color-scheme: light` on `<html>` pins every token in one declaration, and the `@media (prefers-color-scheme: dark)` block disappears entirely rather than being duplicated.

**The one thing `light-dark()` cannot do.** It is a **colour** function. `--shadow-sm`, `--shadow-md` and `--shadow-lg` are whole shadow *lists* — and light and dark do not merely differ in colour, they differ in structure (light has a contact shadow plus an ambient one; dark deliberately has fewer, weaker layers, because "shadows do almost nothing on dark surfaces"). Those three therefore keep an override block. Three duplicated values instead of thirty is the win; pretending it is zero would mean flattening a deliberate design difference.

- [ ] **Step 1: Add `color-scheme` and convert the colour tokens**

In `src/app/globals.css`, replace the opening of the `:root` block (line 14) so it begins:

```css
:root {
  /* "Happy in either scheme, follow the OS" — which is what every token
     below resolves against. An explicit choice overrides this a few rules
     down, and that is the entire switching mechanism: one declaration.
     It also fixes native form controls and scrollbars, which used to stay
     light in dark mode because nothing had ever told the browser. */
  color-scheme: light dark;

  /* Surfaces, from furthest back to nearest front. */
  --surface-sunken: light-dark(oklch(96.5% 0.003 265), oklch(14% 0.006 265));
  --surface: light-dark(oklch(99.2% 0.002 265), oklch(17.5% 0.007 265));
  --surface-raised: light-dark(oklch(100% 0 0), oklch(21.5% 0.008 265));

  /* Text. Three levels is enough hierarchy; a fourth starts to look like a
     bug rather than an intention. */
  --text: light-dark(oklch(21% 0.012 265), oklch(96% 0.003 265));
  --text-secondary: light-dark(oklch(48% 0.011 265), oklch(72% 0.008 265));
  --text-tertiary: light-dark(oklch(62% 0.010 265), oklch(58% 0.008 265));

  --border: light-dark(oklch(91% 0.004 265), oklch(28% 0.008 265));
  --border-strong: light-dark(oklch(84% 0.006 265), oklch(36% 0.010 265));

  /* One accent. A marketplace's colour should come from the photographs, not
     from the chrome competing with them. */
  /* Violet, chosen partly because it is the furthest hue from everything
     already spoken for: --success owns 155 and --danger owns 25, and an
     accent near either makes "saved" and "this is a link" the same signal.
     Contrast against the surfaces is asserted in color-contrast.test.ts,
     which keeps its own copy of these values on purpose — it tests a
     property of the colours, not the contents of this file. */
  --accent: light-dark(oklch(52% 0.20 295), oklch(72% 0.17 295));
  --accent-hover: light-dark(oklch(46% 0.19 295), oklch(78% 0.15 295));
  --accent-contrast: light-dark(oklch(99% 0 0), oklch(16% 0.01 295));
  --accent-subtle: light-dark(oklch(95% 0.04 295), oklch(30% 0.08 295));

  --success: light-dark(oklch(52% 0.13 155), oklch(72% 0.14 155));
  --success-subtle: light-dark(oklch(96% 0.04 155), oklch(26% 0.05 155));
  --danger: light-dark(oklch(55% 0.19 25), oklch(70% 0.17 25));
  --danger-subtle: light-dark(oklch(96% 0.03 25), oklch(27% 0.06 25));
```

Then, further down the same `:root` block, convert `--material-chrome` in place:

```css
  /* Translucent chrome. Content scrolls *under* this rather than being
     clipped by an opaque strip (§12). */
  --material-chrome: light-dark(
    oklch(99.2% 0.002 265 / 0.72),
    oklch(17.5% 0.007 265 / 0.72)
  );
  --material-blur: 20px;
```

Leave `--radius-*`, `--response-*`, `--ease-*` and `--shadow-*` exactly as they are.

- [ ] **Step 2: Replace the dark `@media` block with the scheme rules and the shadow override**

Delete the entire `@media (prefers-color-scheme: dark) { :root { … } }` block (lines 75-106) and put this in its place:

```css
/* The switch. Absent `data-theme`, `color-scheme: light dark` above leaves
   every token following the operating system — which is exactly what this
   site did before the toggle existed, so a reader who never presses it sees
   no change at all. */
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }

/* Shadows cannot go through light-dark(), which is a *colour* function,
   and these are whole shadow lists whose two forms differ in structure
   rather than only in colour: depth on a dark surface comes from the
   surface steps, so the dark set is fewer and weaker layers rather than
   the same layers in another colour. Flattening that to share a structure
   would be changing the design to suit the mechanism.

   So these three keep an override — the only place in this file where a
   value is written twice. The `:not([data-theme="light"])` guard is what
   makes an explicit light choice beat the OS saying dark. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.30);
    --shadow-md: 0 2px 4px oklch(0% 0 0 / 0.30), 0 6px 16px oklch(0% 0 0 / 0.25);
    --shadow-lg: 0 4px 8px oklch(0% 0 0 / 0.35), 0 16px 40px oklch(0% 0 0 / 0.30);
  }
}

:root[data-theme="dark"] {
  --shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.30);
  --shadow-md: 0 2px 4px oklch(0% 0 0 / 0.30), 0 6px 16px oklch(0% 0 0 / 0.25);
  --shadow-lg: 0 4px 8px oklch(0% 0 0 / 0.35), 0 16px 40px oklch(0% 0 0 / 0.30);
}
```

- [ ] **Step 3: Convert the shimmer**

The skeleton shimmer has its own dark `@media` block (around line 726) that swaps a gradient. A gradient's colour stop *is* a colour, so this one converts cleanly. Replace the `.skeleton::after` `background` declaration with:

```css
  background: linear-gradient(
    90deg,
    transparent,
    light-dark(oklch(100% 0 0 / 0.45), oklch(100% 0 0 / 0.06)),
    transparent
  );
```

and **delete** the whole `@media (prefers-color-scheme: dark) { .skeleton::after { … } }` block that followed it. Leave the `prefers-reduced-motion` block below untouched — that is a different user setting and has nothing to do with theme.

- [ ] **Step 4: Verify no `prefers-color-scheme` rule is left deciding a colour**

```bash
grep -n "prefers-color-scheme" src/app/globals.css
```
Expected: exactly **one** match, the shadow override added in Step 2. Any other match means a block was missed and that part of the UI will ignore the toggle.

```bash
npx next build && grep -c "light-dark(" .next/static/chunks/*.css
```
Expected: a build that succeeds and a non-zero count. Zero would mean the function was stripped or the file was not rebuilt (Gotcha #47 — and note the path is `chunks`, not `css`).

- [ ] **Step 5: Confirm the palette still resolves, without a browser**

```bash
npm run dev &
until curl -s -o /dev/null http://localhost:3000; do sleep 2; done
curl -s http://localhost:3000 | grep -o '<html[^>]*>'
```
Expected: the `<html>` tag renders with no `data-theme` yet (nothing sets it until Task 3), which is the correct "follow the system" state. Stop the dev server afterwards with `kill %1` — do **not** use `pkill -f "next dev"`, which matches the agent's own shell and kills the command chain.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "$(cat <<'EOF'
Move the colour tokens onto light-dark()

An explicit theme choice has to beat a media query, and the conventional way
to arrange that is to repeat the whole dark block under an attribute
selector — thirty values living in two places, in the file every colour on
the site flows through.

Each token now names both values once and resolves against color-scheme, so
the dark media block is deleted rather than duplicated and switching is a
single declaration. Setting color-scheme also fixes native form controls and
scrollbars, which had stayed light in dark mode because nothing had ever
told the browser.

The three shadow tokens keep an override: light-dark() takes colours, and
these are shadow lists whose two forms differ in structure rather than
colour, because depth on a dark surface comes from the surface steps. Three
duplicated values rather than thirty, and the difference is deliberate.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Apply the theme before the first paint

**Files:**
- Modify: `src/app/layout.tsx` — add the script, rewrite the Gotcha #38 comment

**Interfaces:**
- Consumes: `THEME_INIT_SCRIPT` from `src/lib/theme.ts` (Task 1).
- Produces: `<html data-theme="…">` on any visit where a choice has been stored, which Task 2's CSS acts on and Task 4's button toggles.

**Why this is its own task:** it is the one change that can make the site render nothing at all. A script that throws in `<head>` blocks the document, and this one is the first inline script the project has ever shipped.

- [ ] **Step 1: Render the script in `<head>`**

In `src/app/layout.tsx`, add the import:

```tsx
import { THEME_INIT_SCRIPT } from "@/lib/theme";
```

Then, inside the `<html>` element and **before** `<body>`, add a `<head>` containing the script:

```tsx
      <head>
        {/*
          Runs before the first paint, which is the whole point: anything
          deferred paints the system theme and then corrects it, and that
          flash happens on every page load rather than once.

          `dangerouslySetInnerHTML` is the only way to emit an inline script
          from JSX, and the name overstates the risk here — the content is a
          module constant built from two string literals, with no interpolated
          input of any kind. The CSP permits it (`script-src 'self'
          'unsafe-inline'`); do not "improve" this into an external file,
          which would defer it and reintroduce the flash.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
```

Next injects its own tags into `<head>` alongside anything you render there; an explicit `<head>` element is supported and does not replace them.

- [ ] **Step 2: Rewrite the `suppressHydrationWarning` comment**

The existing comment on `<html>` ends with *"Reconsider if a script is ever added that sets an attribute on `<html>`."* That script now exists, so the comment currently tells the next reader the opposite of the truth. Replace its final paragraph — the one beginning "This suppresses the warning" — with:

```
        This suppresses the warning for *this element's own attributes only*.
        It does not cascade to children, so it cannot hide a real mismatch
        inside a page.

        It now covers a real one, deliberately. The theme script sets
        `data-theme` on this element before React hydrates, so the client's
        <html> genuinely differs from the server's whenever a reader has
        chosen a theme — the server cannot know which, and the alternative is
        rendering the wrong colours first and correcting them. That is the
        trade: the warning is suppressed here because a mismatch on this one
        element is expected, and the cost is that an *unexpected* one on
        <html> would also pass unnoticed.
```

- [ ] **Step 3: Verify the script ships and does not break the page**

```bash
npx tsc --noEmit && npx eslint && npx next build
npm run dev &
until curl -s -o /dev/null http://localhost:3000; do sleep 2; done
curl -s http://localhost:3000 | grep -o 'localStorage.getItem("theme")'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000
```
Expected: the script text appears in the served HTML, and the page still answers `200`. Stop the dev server with `kill %1`.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "$(cat <<'EOF'
Apply the stored theme before the first paint

Inline and synchronous in <head>, because anything deferred paints the
system theme and then corrects it — a flash on every page load rather than
once. It is the first inline script this project has shipped; the CSP
already permits it, which was checked before the design rather than after.

The suppressHydrationWarning comment on <html> is rewritten. It ended by
telling the next reader to reconsider if a script were ever added that sets
an attribute there, and this is that script, so the note now says what the
suppression actually covers and what it costs.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: The button

**Files:**
- Create: `src/components/ThemeToggle.tsx`
- Modify: `src/app/globals.css` (append the icon/label switching rules to the components layer)
- Modify: `src/components/SiteHeader.tsx` (place it in the nav)

**Interfaces:**
- Consumes: `THEME_ATTRIBUTE`, `THEME_STORAGE_KEY`, `isTheme`, `nextTheme` from `src/lib/theme.ts` (Task 1); the `data-theme` mechanism from Task 2.
- Produces: nothing later tasks depend on.

**The shape, and why.** The button renders **both** icons and **both** screen-reader labels every time, and CSS hides one pair. The server has no idea what theme the reader has chosen, so any design where the rendered output depends on that state either mismatches at hydration or flickers after it. Rendering both makes the server's markup constant.

The click handler reads the *current* state off the DOM attribute rather than from React state, for the same reason: the attribute is the truth, set by a script that ran before React existed.

- [ ] **Step 1: Write the component**

Create `src/components/ThemeToggle.tsx`:

```tsx
"use client";

import { THEME_ATTRIBUTE, THEME_STORAGE_KEY, isTheme, nextTheme } from "@/lib/theme";

/**
 * Switches between light and dark, and remembers it.
 *
 * It holds no React state, which is the whole design. The server cannot know
 * which theme a reader has chosen, so anything that renders differently per
 * theme either mismatches during hydration or corrects itself after paint —
 * a flicker on every navigation. Instead both icons and both labels are
 * always rendered and CSS hides one pair, so the server's markup is identical
 * every time and there is nothing to reconcile.
 *
 * For the same reason the click reads the current theme off the DOM rather
 * than from state: `data-theme` is set by a script that ran before React
 * loaded, so the attribute is the truth and React never held it.
 *
 * The icon reports the mode you are *in* rather than the one you would get,
 * which is the less common convention and was chosen deliberately. The
 * accessible name says what the press does, so the two together are
 * unambiguous whether or not you can see the icon.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const stored = root.getAttribute(THEME_ATTRIBUTE);

    // No attribute means the reader is still following the system, so read
    // what the system actually resolved to rather than assuming a side.
    const current = isTheme(stored)
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

    const chosen = nextTheme(current);
    root.setAttribute(THEME_ATTRIBUTE, chosen);

    // Storage can throw outright in some privacy modes. The theme still
    // applies for this page; it just will not survive a reload, which is a
    // better outcome than an unhandled error from a button press.
    try {
      localStorage.setItem(THEME_STORAGE_KEY, chosen);
    } catch {}
  }

  return (
    <button type="button" onClick={toggle} className="btn btn-ghost btn-sm theme-toggle">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="theme-icon-sun h-[1.125rem] w-[1.125rem]"
      >
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.2M12 19.2v2.2M4.35 4.35l1.55 1.55M18.1 18.1l1.55 1.55M2.6 12h2.2M19.2 12h2.2M4.35 19.65l1.55-1.55M18.1 5.9l1.55-1.55" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="theme-icon-moon h-[1.125rem] w-[1.125rem]"
      >
        <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z" />
      </svg>
      {/* Both labels ship; CSS shows the one that matches, the same way the
          icons do. The label names the action even though the icon names the
          state, so a press is never a guess. */}
      <span className="theme-label-dark sr-only">Switch to dark mode</span>
      <span className="theme-label-light sr-only">Switch to light mode</span>
    </button>
  );
}
```

- [ ] **Step 2: Add the switching rules**

Append to the `@layer components` block in `src/app/globals.css`, after `.invite-tile`:

```css
  /* The theme button ships both icons and both labels and hides one pair,
     so its markup never depends on state the server cannot know. These
     rules are the only thing that makes it a *toggle* rather than two
     stacked glyphs, so they are not optional decoration.

     Light is the default branch: with no `data-theme` the reader is
     following the OS, so the media query decides, and an explicit choice
     overrides it through the attribute selectors below. */
  .theme-toggle { padding-left: 0.5rem; padding-right: 0.5rem; }

  .theme-icon-moon,
  .theme-label-light { display: none; }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) .theme-icon-sun,
    :root:not([data-theme="light"]) .theme-label-dark { display: none; }
    :root:not([data-theme="light"]) .theme-icon-moon { display: inline-block; }
    :root:not([data-theme="light"]) .theme-label-light { display: inline; }
  }

  :root[data-theme="dark"] .theme-icon-sun,
  :root[data-theme="dark"] .theme-label-dark { display: none; }
  :root[data-theme="dark"] .theme-icon-moon { display: inline-block; }
  :root[data-theme="dark"] .theme-label-light { display: inline; }

  :root[data-theme="light"] .theme-icon-sun { display: inline-block; }
  :root[data-theme="light"] .theme-label-dark { display: inline; }
```

- [ ] **Step 3: Put it in the header**

In `src/components/SiteHeader.tsx`, add the import:

```tsx
import { ThemeToggle } from "@/components/ThemeToggle";
```

and render it as the **first** child of the `<nav>`, before the "My listings" link:

```tsx
        <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          <ThemeToggle />
```

First in the nav rather than last so that when the bar wraps on a narrow phone — which PR #44 made it do gracefully — the button that wraps away is a rarely-used one rather than this one.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npx eslint && npx next build
grep -c "theme-icon-moon" .next/static/chunks/*.css
```
Expected: clean, and the grep at least `1`. Zero means the rules did not emit and the button will show both icons at once (Gotcha #47).

```bash
npm run dev &
until curl -s -o /dev/null http://localhost:3000; do sleep 2; done
curl -s http://localhost:3000 | grep -o 'theme-toggle[^<]*' | head -1
curl -s http://localhost:3000 | grep -c 'Switch to dark mode'
curl -s http://localhost:3000 | grep -c 'Switch to light mode'
```
Expected: the button present, and **both** labels found exactly once each — that is the property the whole design rests on, so confirm it rather than assuming. Stop the dev server with `kill %1`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ThemeToggle.tsx src/components/SiteHeader.tsx src/app/globals.css
git commit -m "$(cat <<'EOF'
Add the theme button

It holds no React state, which is the design rather than an economy. The
server cannot know which theme a reader chose, so anything rendering
differently per theme either mismatches at hydration or corrects itself
after paint — a flicker on every navigation. Both icons and both labels
always render and CSS hides one pair, so the server's markup is constant.

The click reads the current theme off the DOM for the same reason: the
attribute was set by a script that ran before React loaded, so it is the
truth and React never held it. With no attribute it asks the media query
rather than assuming a side.

The icon reports the mode you are in; the accessible name says what the
press does. It sits first in the nav so that when the bar wraps on a narrow
phone it is a rarer control that wraps away instead.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Verification, documentation, and the pull request

**Files:**
- Modify: `AGENTS.md` — Current State, one Decision Log entry, and the Gotcha #38 cross-reference
- Modify: `docs/superpowers/specs/2026-08-16-theme-toggle-design.md:4` (`Status:`)

**Interfaces:** none.

- [ ] **Step 1: Run everything and record the real output**

```bash
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
npx tsc --noEmit && echo "tsc clean"
npx eslint && echo "eslint clean"
npx next build 2>&1 | tail -5
```
Expected: **399 passing**, the rest clean. Write the real numbers down; they go into `AGENTS.md` and the PR. If anything fails, stop and report rather than documenting a green run that did not happen.

- [ ] **Step 2: Confirm the three states from a terminal**

The theme cannot be clicked without a browser, but all three states are reachable by asserting on what is served and what the CSS contains:

```bash
npm run dev &
until curl -s -o /dev/null http://localhost:3000; do sleep 2; done

# 1. Unset: no attribute, so the OS decides.
curl -s http://localhost:3000 | grep -o '<html[^>]*>' | grep -c 'data-theme' || echo "unset — correct"

# 2. The stylesheet can express both pinned states.
grep -o 'data-theme="dark"' .next/static/chunks/*.css | head -2
grep -o 'data-theme="light"' .next/static/chunks/*.css | head -2

# 3. Exactly one prefers-color-scheme rule survives in source (the shadows).
grep -c "prefers-color-scheme" src/app/globals.css
```
Expected: no `data-theme` on a fresh visit; both attribute selectors present in the built CSS; and the source count is **2** — the shadow override from Task 2 and the icon-switching rule from Task 4. Stop the dev server with `kill %1`.

Note what you could *not* check: whether the colours are right, whether the icon is legible, and whether the switch actually happens on click. A human does that.

- [ ] **Step 3: Update the spec status**

In `docs/superpowers/specs/2026-08-16-theme-toggle-design.md`, change line 4 from `**Status:** Approved, not yet implemented` to `**Status:** Implemented 2026-08-16 (branch `feature/theme-toggle`)`.

- [ ] **Step 4: Update `AGENTS.md`**

Three edits, in the file's own voice — read the surrounding Decision Log entries first; they are specific, name what was wrong, and carry no marketing.

1. **Current State** — note that the site now has a light/dark toggle in the header, that the default is unchanged (follow the OS until pressed), and update the test count to 399.

2. **Decision Log** — one dated `2026-08-16` entry covering: that "system" is the absence of a stored value rather than a third button position, and what that costs (no route back once pinned); that the button holds no React state because the server cannot know the theme, and what the alternatives were; that tokens moved to `light-dark()` rather than duplicating the dark block, with the shadows as the stated exception because `light-dark()` is a colour function and the two shadow sets differ in structure; and that `color-scheme` was set as much for native form controls and scrollbars as for the tokens.

3. **Known Gotchas #38** — that entry's advice to reconsider `suppressHydrationWarning` "if a script is ever added that sets an attribute on `<html>`" has now been acted on. Append a line saying the script exists, that the suppression was kept deliberately, and that it now covers an expected mismatch — so an unexpected one on that element would pass unnoticed.

- [ ] **Step 5: Commit and open the pull request**

```bash
git add AGENTS.md docs/superpowers/specs/2026-08-16-theme-toggle-design.md docs/superpowers/plans/2026-08-16-theme-toggle.md
git commit -m "$(cat <<'EOF'
Record the theme toggle

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"

gh auth status
```

If `gh auth status` reports `skibidam` as the active account, run `gh auth switch --user adamafzainizam` — an earlier successful `gh` call is not evidence the right account is still active, and it has drifted mid-session before.

```bash
eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_ed25519_new
git push -u origin feature/theme-toggle
```

Then open the PR with `gh pr create --base main`. The body should state plainly which checks were run and that **nothing was confirmed in a browser** — no agent on this plan can see the colours change. List for the reviewer: the switch itself, both pinned states, that a reload keeps the choice, that a fresh profile still follows the OS, and that there is no flash of the wrong theme on load.

---

## Self-review

**Spec coverage.** Two states with an unset third (Task 1's `isTheme` plus Task 2's `color-scheme: light dark`); the icon reporting current mode with the action in the accessible name (Task 4); the stateless button (Task 4); `light-dark()` tokens (Task 2); the inline script and its CSP dependency (Tasks 1 and 3); the Gotcha #38 comment rewrite (Task 3 step 2) and its cross-reference (Task 5); the shared-constants test (Task 1); the header placement and expected wrap (Task 4 step 3). Out-of-scope items — a three-state control, per-page theming, colour transitions, rewiring `color-contrast.test.ts` — appear in no task.

**Two things the spec did not anticipate, resolved here.** `light-dark()` is a colour function, so the three `--shadow-*` tokens cannot use it and keep an override; the spec implied every token converts. And the skeleton shimmer's dark block *does* convert, since a gradient stop is a colour — the spec left it ambiguous.

**Type consistency.** `Theme`, `THEME_STORAGE_KEY`, `THEME_ATTRIBUTE`, `nextTheme`, `isTheme` and `THEME_INIT_SCRIPT` are defined in Task 1 and used under exactly those names in Tasks 3 and 4. The class names `theme-toggle`, `theme-icon-sun`, `theme-icon-moon`, `theme-label-dark` and `theme-label-light` are introduced in Task 4 step 1 and styled under the same names in step 2.
