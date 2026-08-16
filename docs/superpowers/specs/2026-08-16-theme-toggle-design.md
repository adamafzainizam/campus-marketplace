# A light/dark toggle

**Date:** 2026-08-16
**Status:** Approved, not yet implemented

## Why this exists

The site has had a dark mode since the design revamp, and no way to choose it. It follows `prefers-color-scheme` and nothing else, so a reader whose phone is set to dark at night gets a dark marketplace whether or not that is what they want to look at, and a reader on a light phone can never see the dark treatment at all.

Found by the builder using the deployed site, which is where every real defect on this project has been found.

## Decisions

### Two states, and an unset third that is not a button position

`localStorage["theme"]` holds `"light"` or `"dark"`, or is **absent**. Absent means follow the operating system, which is exactly today's behaviour — so nobody who ignores this feature experiences a change. Pressing the button writes the key and pins the choice.

Rejected: a three-position Light / Dark / System control. The builder asked for a plain button, and the third state earns its keep as a *default* rather than as a thing to look at. The cost is stated rather than hidden: once pinned, there is no route back to "follow my phone" short of clearing site data. That is an acceptable trade for a control that explains itself at a glance.

### The icon reports the current mode, not the destination

A crescent while dark, a sun while light. The commoner convention is the opposite — the icon as a promise about what the press will do — and the builder chose this one deliberately.

The ambiguity that creates is handled in the accessible name rather than by overriding the choice: the button is labelled **"Switch to light mode"** / **"Switch to dark mode"**, so what the press does is never in doubt for anyone who cannot see the icon, and the icon stays a status.

### The button carries no JavaScript state

It renders **both** icons and **both** screen-reader labels, and CSS shows the correct pair based on the `data-theme` attribute the page already carries. JavaScript handles the click and nothing else.

This is the load-bearing decision. The obvious build — hold the theme in `useState`, pick an icon — cannot render correctly on the server, because the server does not know the reader's theme. That produces either a hydration mismatch or an effect that swaps the icon after paint, which is a visible flicker on every navigation. Rendering both and letting CSS choose makes the server output identical every time, so there is nothing to reconcile.

### Tokens move to `light-dark()`

The dark values currently live in `@media (prefers-color-scheme: dark)`. An explicit choice has to beat a media query, and the conventional fix is to repeat the whole dark block under `:root[data-theme="dark"]` — roughly thirty token values existing twice, in a file where a third copy already exists inside `color-contrast.test.ts`.

Instead each token names both values once:

```css
:root {
  color-scheme: light dark;
  --surface: light-dark(oklch(99.2% 0.002 265), oklch(17.5% 0.007 265));
}
```

Switching is then a single `color-scheme` declaration on `<html>`, driven by `data-theme`. The `@media (prefers-color-scheme: dark)` token block is deleted outright, because `light-dark()` already resolves against the computed `color-scheme`, and `color-scheme: light dark` follows the OS until something overrides it.

Rejected: duplicating the block. It is the smaller diff, and duplication in exactly these values is what the card-redesign branch spent ten tasks removing.

**Two things this does not change.** The skeleton shimmer's own `@media (prefers-color-scheme: dark)` block at the end of the file sets a `background` rather than a token, and is converted the same way rather than left as the one thing still keyed to the OS. And `color-contrast.test.ts` keeps its hardcoded values: it asserts a contrast property of specific colour pairs, not that the stylesheet contains them, and coupling it to the stylesheet is a separate piece of work.

## What could go wrong, and what stops it

1. **A flash of the wrong theme.** The attribute has to be on `<html>` before the first paint, so a synchronous inline script in `<head>` reads `localStorage` and stamps it. Asynchronous or deferred loading here means every visit begins with the wrong colours.
2. **The CSP blocking that script.** Verified before designing: `script-src 'self' 'unsafe-inline'`, so an inline script runs. This project has had three production outages from that one policy, and a nonce-only policy would have made this the fourth.
3. **Gotcha #38's suppression now covers a real mismatch.** `<html>` carries `suppressHydrationWarning`, and its comment ends *"Reconsider if a script is ever added that sets an attribute on `<html>`."* This is that script. The suppression stays, because browser extensions still write there and that is what it was for — but the comment must be rewritten to say that a genuine theme mismatch is now possible and would be masked. Leaving a comment that says the opposite is worse than having no comment.
4. **The script and the button drifting apart.** They agree on a storage key and an attribute name and live in different files. Both come from `src/lib/theme.ts`, which exports the key, the attribute, `nextTheme()`, and the script itself as a string, with tests asserting the script mentions what the button writes.
5. **The header running out of room.** A ~40px button joins a bar that fits a 360px signed-in phone with roughly 30px to spare, so it will likely wrap to a second line there. The wrap is already built and graceful (PR #44); this is stated so the next person knows it was expected rather than missed.

## What gets built

| File | Responsibility |
|---|---|
| `src/lib/theme.ts` | The storage key, the attribute name, `nextTheme()`, and the inline script as a string. No I/O, no React. |
| `src/lib/theme.test.ts` | That `nextTheme` alternates, and that the script text references the same key and attribute the component uses. |
| `src/components/ThemeToggle.tsx` | The button. Client component, both icons, both labels, one click handler. |
| `src/app/layout.tsx` | Renders the inline script in `<head>`; the Gotcha #38 comment rewritten. |
| `src/components/SiteHeader.tsx` | Places the toggle in the nav. |
| `src/app/globals.css` | Tokens converted to `light-dark()`; both `prefers-color-scheme` blocks removed; the rules that show one icon and one label. |

## Out of scope

- A three-state control, or any route back to "follow the system" once pinned.
- Per-page or per-component theming.
- Transitioning colours when the theme changes. A cross-fade on every token is a lot of machinery for an action taken about twice.
- Coupling `color-contrast.test.ts` to the stylesheet.
