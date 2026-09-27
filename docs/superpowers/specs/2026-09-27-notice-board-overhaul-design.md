# Front-end overhaul: "Notice board"

**Date:** 2026-09-27
**Status:** Approved in brainstorming, not yet implemented
**Supersedes:** the *visual* decisions of `2026-08-16-design-revamp-design.md` (Space Grotesk + Inter, the violet accent, rounded shapes, translucent chrome) and the card styling of `2026-08-16-listing-cards-and-identity-design.md`. It **keeps** their voice ("student-made, and proud of it"), their information architecture, their spacing scale, and the card's content model (`ListingMeta`, `NoPhoto`, the invite tile, the three-column cap on a thin board).
**Visual reference:** `assets/2026-09-27-notice-board/reference.html` (and `.png`). Open it before implementing anything visual. Light mode is as shown; dark mode is **option 2, grey shadows**. Photos there are placeholders and the pushpin emoji stands in for `PinMark`.

## Why this exists

The August revamp changed tokens, fonts and copy and was received as "the original with different fonts and colors". That verdict was accurate: no component changed shape. This overhaul is a new visual language, chosen from rendered mockups (never from description, per the Decision Log entry of 2026-08-16), and it is scoped by **component as well as by page** so the most repeated element on the site cannot fall outside every phase.

## Design read and dials

> Reading this as: an **overhaul** of a peer-to-peer campus marketplace for GMI students and staff (with recruiters reading it as a portfolio piece), in a **printed notice-board** language, built on the project's own CSS tokens plus Tailwind v4, with no component library.

The governing skill is `design-taste-frontend`. It is written for landing pages; this is product UI, so its dials are set for that rather than at its landing-page baseline:

| Dial | Value | Why |
|---|---|---|
| `DESIGN_VARIANCE` | 5 | Offset shadows and a slightly rotated stamp carry the character; layouts stay orderly because people are scanning listings, not being marketed to. |
| `MOTION_INTENSITY` | 4 | Feedback motion only (press, hover, state change). CSS transitions, no animation library. |
| `VISUAL_DENSITY` | 5 | A marketplace grid is a daily-app surface. |

## How far the taste skill reaches, per surface

The skill says it does not cover admin panels, multi-step forms or realtime chat. So:

| Surface | Treatment |
|---|---|
| Header, footer, breadcrumbs, browse, listing card, listing detail, `/listings/mine`, sign-in, empty/loading states | **Full**: layout, components and copy follow the skill. |
| Listing form, photo picker | **Tokens and components only**: new fields, buttons and drop zone; the form's structure is not redesigned. |
| Inbox, conversation thread | **Tokens only**. The thread's layout and height contract (Gotchas #33, #37) are not touched. |
| `/admin/*`, `/legal/*` | **Tokens only**. Legal **wording is not changed at all**. |

## What does not change

URLs and route slugs; navigation destinations; form field names and order; the theme mechanism (`data-theme`, the init script, `THEME_ATTRIBUTE`, "system" meaning no stored value); `AFFILIATION_DISCLAIMER` and all legal copy; the copy voice rules in `site-copy.ts` (only em-dashes change, see Phase 8); the spacing scale recorded in `globals.css`; server/client component boundaries except where named below.

---

## 1. Visual system (Phase 1: Foundation)

### 1.1 Palette: two layers

`globals.css` gets a **brand primitives** block. Every semantic token is defined *only* in terms of primitives. Swapping to GMI's palette, if GMI approves (Decision Log to be written: "independent now, swappable later"), is then an edit to this one block.

Primitive values (Tailwind v4's own OKLCH values for the named colours):

| Primitive | Value | Named / source |
|---|---|---|
| `--brand-paper` | `oklch(98.5% 0.001 106.4)` | `#fafaf9` |
| `--brand-paper-sunken` | `oklch(96% 0.002 106.4)` | a step below paper |
| `--brand-card` | `oklch(100% 0 0)` | white |
| `--brand-ink` | `oklch(21% 0.006 285.9)` | `#18181b` |
| `--brand-ink-2` | `oklch(44.2% 0.015 285.8)` | `#52525b` |
| `--brand-ink-3` | `oklch(52% 0.014 285.9)` | darker than `#71717a`, so it passes AA on the sunken surface |
| `--brand-night` | `oklch(17.9% 0.004 286)` | `#111113` |
| `--brand-night-sunken` | `oklch(15% 0.004 286)` | a step below night |
| `--brand-night-card` | `oklch(21.9% 0.006 285.9)` | `#1a1a1d` |
| `--brand-night-line` | `oklch(37% 0.012 285.8)` | `#3f3f46` |
| `--brand-night-control` | `oklch(55.2% 0.014 285.9)` | `#71717a`, borders of form controls in dark |
| `--brand-snow` | `oklch(96.7% 0.001 286.4)` | `#f4f4f5` |
| `--brand-snow-2` | `oklch(71.2% 0.013 286.1)` | `#a1a1aa` |
| `--brand-snow-3` | `oklch(63.9% 0.012 286.1)` | `#8b8b93` |
| `--brand-highlight` | `oklch(90.5% 0.166 98.1)` | `#fde047`, the approved yellow |

These are the mockup's exact colours converted to OKLCH. Success and danger also become primitives (`--brand-success-day`, `--brand-success-night`, and so on), holding their current values.

`--success` and `--danger` keep their hues (155 and 25) and current values unless the contrast test fails against the new surfaces, in which case only lightness moves and the new value is recorded in the Decision Log.

**If any contrast pair below fails, move the primitive's lightness until it passes and record the value.** The numbers above are starting points chosen to pass; the test is the authority.

### 1.2 Semantic tokens

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--surface` | paper | night | page |
| `--surface-raised` | card | night-card | cards, fields, tags on photos |
| `--surface-sunken` | paper-sunken | night-sunken | photo wells, skeletons, ghost-button hover |
| `--text` / `-secondary` / `-tertiary` | ink / ink-2 / ink-3 | snow / snow-2 / snow-3 | text |
| `--line` | ink | night-line | card, chip, tag and header borders (decorative) |
| `--control-line` | ink | night-control | borders of fields, secondary buttons and the drop zone, which must meet 3:1 (WCAG 1.4.11); zinc-700 on charcoal is only about 1.9:1 |
| `--shadow-color` | ink | night-line | offset shadows |
| `--action` | ink | highlight | primary button fill |
| `--action-contrast` | highlight | ink | primary button text |
| `--highlight` | highlight | highlight | fills: headline marker, "For rent", selected chip, unread badge, own message bubble |
| `--on-highlight` | ink | ink | text on any highlight fill |
| `--link` | ink | highlight | link text |
| `--link-decoration` | highlight | highlight | link underline |
| `--focus` | ink | highlight | focus rings |

**The one rule about yellow:** in light mode yellow is **never text and never a hairline on a light surface**, only a fill with ink on it (yellow on paper is about 1.3:1). Yellow text on an ink fill, as on the light-mode primary button, is fine (about 14:1). This is why the primary button inverts between themes.

`--accent*` is retired. Every current use (5x `text-accent`, 3x `bg-accent`, 1x `text-accent-contrast`, 1x `border-accent`, `.badge-accent`, `.btn-primary`, `.dropzone`, `.invite-tile`, `accent-color`) is mapped to one of the tokens above; the Phase 1 plan lists each site. `accent-color` for native controls becomes `var(--action)`.

### 1.3 Shape

- `--radius: 3px` on cards, buttons, fields, chips, notices, the drop zone and the photo frame. `--radius-sm: 2px` on tags and badges. **No pills anywhere**; `--radius-full` is removed except for genuinely circular things (avatar dots, if any).
- Borders are `1.5px solid var(--line)` on cards, fields, buttons (secondary), chips and tags. The header bottom border is `2px`.

### 1.4 Depth and motion

- Cards: `box-shadow: 3px 3px 0 var(--shadow-color)`. Buttons (primary and secondary): `2px 2px 0`. Ghost buttons: none.
- **Hover** (pointer devices only, `@media (hover: hover)`): interactive cards `translate(-1px, -1px)` with a `4px 4px 0` shadow.
- **Press**, on pointer-down as now: buttons `translate(2px, 2px)` and interactive cards `translate(3px, 3px)`, each travelling exactly its own shadow's depth, with shadow `0 0 0`. It reads as pushing a pin into the board. (Amended in Phase 1: the card travels 3px because its shadow is 3px.)
- Transitions touch only `transform`, `box-shadow`, `opacity`, `background-color` and `border-color`, using the existing `--response-fast` and `--ease-out`. Anything else (link underline thickness, text colour, outline colour) changes instantly.
- `prefers-reduced-motion: reduce`: no translation; the shadow change still happens, instantly.
- `prefers-contrast: more`: borders become 2px.
- The old `translateY(-2px)` lift and `scale()` presses are removed.

### 1.5 Typography

- **Archivo** via `next/font/google` (variable weight), replacing Space Grotesk and Inter. The CSP is `font-src 'self' data:`, so it must be self-hosted through `next/font`, never a `<link>` (Gotcha #46).
- Weights: 900 display headings and prices; 800 buttons and strong labels; 600 card titles; 400 and 500 body.
- The existing heading scale classes are kept (`text-display` and friends) and re-tuned for Archivo: tighter tracking on display sizes (about `-0.03em`), `leading-none` only where there are no descenders at risk; any italic display word gets `leading-[1.1]` minimum.
- Legal prose: Archivo 400, `max-width: 65ch`, `line-height: 1.6`.

### 1.6 Icons

- Add `@phosphor-icons/react` (free, MIT). Before writing code, check the installed version's README for the Server Component import path (historically `@phosphor-icons/react/dist/ssr`) and use it in Server Components. Check `npm warn allow-scripts` output after install (Gotcha #11).
- One weight: **bold**, to sit with 1.5px borders. Default size set in one small module (`src/components/icons.ts` or similar) so it is not repeated per call site.
- Replaces the hand-drawn SVGs in `ThemeToggle`, `PhotoPicker` and `NoPhoto`. **`PinMark` and `src/app/icon.svg` stay hand-drawn**: they are the logo, not icons. The favicon's baked colour is updated to the new ink/highlight and `icon.test.ts` updated with it.

### 1.7 Component classes

The shared classes are rebuilt on the tokens above, keeping their names so pages change without edits:

| Class | New look |
|---|---|
| `.btn-primary` | `--action` fill, `--action-contrast` text, 1.5px `--line` border, 2px offset shadow, Archivo 800 |
| `.btn-secondary` | `--surface-raised` fill, `--text`, 1.5px border, 2px offset shadow |
| `.btn-ghost` | no border, no shadow; hover fills `--surface-sunken` |
| `.field` | `--surface-raised`, 1.5px `--line` border, 3px radius; focus: 2px `--focus` outline offset 2px; placeholder `--text-tertiary` (must pass AA) |
| `.label` | Archivo 700, above the field; errors below |
| `.chip` | square, 1.5px border, Archivo 600; `.chip-selected` is `--highlight` fill with `--on-highlight` text |
| `.badge-*` | square tags; the rental tag uses `--highlight`; the service tag is an ink outline |
| `.card` | `--surface-raised`, 1.5px border, 3px offset shadow |
| `.notice-*` | square, 1.5px border in the notice's own colour |
| `.dropzone`, `.invite-tile` | dashed 1.5px `--line`; hover makes the border solid |
| `.skeleton` | `--surface-sunken`, same shape and radius as what it stands in for |

`.btn` labels must **never wrap** at any width (the reference PNG shows "Message seller" wrapping in a narrow column; that is a defect to avoid, fixed by `white-space: nowrap` plus letting the button row wrap instead).

---

## 2. Components and pages

### Phase 2: Chrome

- **Header**: 64px, sticky, **solid** `--surface` background (the translucent `--material-chrome` blur is removed with its reduced-transparency fallback), 2px `--line` bottom border.
  - Desktop (`sm` and up): `PinMark` + wordmark (Archivo 800) · Messages (unread badge: `--highlight` fill) · My listings · theme toggle · **Post a listing** (the only `btn-primary` in the header).
  - Mobile (below `sm`): the dropdown approved 2026-08-17 (roadmap 4d). Its closed state names the current section, from a pure `currentSection(pathname)` in `src/lib/` with tests, rendered by a thin `"use client"` shell using `usePathname()`. **Post a listing** and the theme toggle stay outside the menu. The full labels "My listings" and "Post a listing" return, retiring "Mine" and "Post". The menu closes on navigation, on Escape, and on outside click; it is keyboard-operable and announces its expanded state. The Events entry belongs to 4d, not here.
  - **Check the conversation thread page before merging**: the header lives in the root layout (Gotchas #33, #37), and an open dropdown is the first thing this header draws over the page.
- **Footer**: 1.5px `--line` top border; content and disclaimer text unchanged; still hidden on the thread page via `.thread-viewport`.
- **Breadcrumbs**: separators become `/`, tertiary text; current crumb in `--text`.
- **ThemeToggle**: Phosphor sun/moon; behaviour and markup contract (both icons rendered, CSS picks one) unchanged.

### Phase 3: Browse

- **Hero**: left-aligned. `HOME_HEADLINE` with **"GMI."** wrapped in a highlighter `<mark>` (`--highlight` fill, `--on-highlight` text, small horizontal padding); max two lines at every width. `HOME_TAGLINE` below. Then the search field and its button. Top padding no more than `pt-10` so **the first row of listings is visible without scrolling at 1280×800** and the first card's top edge is visible at 375×740.
  - **No hero photograph, deliberately.** The skill asks for a real hero image; here the listings are the imagery, and a campus stock photo would be both fake and GMI-flavoured. Recorded as a taste-skill exception.
- **Filters**: the type filter (All / For sale / For rent / Services) and the category rail use the square chips. The rail keeps its single scrolling row.
- **Listing card** (`src/app/page.tsx` grid, and wherever the card is reused):
  - Photo well 4:3 with a 1.5px bottom border; `NoPhoto` becomes a diagonal-stripe fill in `--surface-sunken` tones with a Phosphor image icon and "No photo".
  - Title Archivo 600, one line, truncated. Price via the existing price classes, Archivo 900, unit de-emphasised.
  - Meta line: **"Category · Condition"** on the left, recency right-aligned on the same row in `--text-tertiary`. At most one middle dot per line. The omission rules in `listingMetaParts` still apply (a service has no condition); its tests are updated for the new split.
  - Tags on the photo: "For rent" `--highlight`; "Service" ink-outline tag on `--surface-raised`. Sale listings carry no tag.
  - **Sold / Reserved / Rented out**: a **stamp**: an ink-bordered, `--surface-raised` label rotated about `-6deg`, Archivo 900 uppercase, centred on the photo, with the photo at reduced opacity. Replaces the current `bg-black/50` veil. The label text still comes from `statusLabel()`.
- **Invite tile**: dashed "empty pin space" in the card's exact shape, copy unchanged except em-dashes.
- **Empty states** (`EMPTY_NOTHING_POSTED`, `EMPTY_NO_MATCHES`): a `.card` with an Archivo 900 heading and one action.
- **`loading.tsx`**: skeleton cards matching the new card, including the offset shadow.

### Phase 4: Listing detail and `/listings/mine`

- **Detail**: two columns from `md` (gallery left, facts right), one column below. As in the reference:
  - Gallery frame with 1.5px border and 3px offset shadow; thumbnails 1.5px-framed, the active one with a 2px `--focus`-coloured outline, offset 1px; they remain buttons, keyboard-navigable as now.
  - Breadcrumb, title (display scale), price (large, 900), facts as square tags (type, condition, quantity, halal statement, all via their existing label functions, wording unchanged).
  - Description in `--text-secondary`, 65ch.
  - **Message seller** primary, **Report** secondary, in a row that wraps rather than letting a label wrap.
  - Seller line below a dashed 1.5px divider.
  - Seller-only controls (edit, status) and admin takedown keep their current placement, restyled.
- **`/listings/mine`**: the same card language; the status control sits on each card. Empty state uses `MINE_EMPTY`.

### Phase 5: Forms (tokens and components only)

- `ListingForm`: new `.field`, `.label`, `.chip`, `.btn` styles; label above, error below; no structural change; the conditional controls (type, rental period, service rate, halal, quantity, "Other") keep their logic and order. Native radios and checkboxes pick up `accent-color: var(--action)`.
- `PhotoPicker`: `.dropzone` in the dashed style, Phosphor upload icon, thumbnails framed like gallery thumbnails.
- Sign-in: one centred `.card` (centring is right for an auth page), headline, intro, the domain requirement rendered from `ALLOWED_DOMAIN_LABEL` as now, the Google button as `btn-primary`.
- `/listings/[id]/edit` shares the form and gets the change for free.

### Phase 6: Messages (tokens only)

- Inbox rows: `.card` language, unread badge `--highlight`.
- Thread: own bubbles `--highlight` fill with `--on-highlight` text; the other party's `--surface-raised` with 1.5px border. The thread's DOM structure, flex/height classes and `.thread-viewport` marker are **not edited**. The h1 size deviation documented there stays.

### Phase 7: Admin and legal (tokens only)

- Admin tables and actions pick up the new tokens and components; no layout change.
- Legal pages: Archivo body at 65ch. **No wording changes, including their em-dashes**: the skill bans em-dashes but its own rule 11.F forbids silent legal edits. Sweeping them would be a separate, explicitly approved change.

### Phase 8: Sweep

- Replace every em-dash (and en-dash used as a separator) in **visible UI strings** outside `/legal`: `site-copy.ts` and any JSX text. Code comments are not UI and are left alone. Rewrite the sentence rather than swapping in a hyphen where a hyphen reads badly. Add a test to `site-copy.test.ts` asserting no exported string contains `—` or `–`.
- Run the skill's Section 14 pre-flight checklist against every page; items that do not apply to product UI (logo walls, bento, testimonials) are marked N/A in the PR, not silently skipped.
- Screenshot pass (see Verification) across all signed-out pages; builder walk of signed-in pages.

---

## 3. Recorded exceptions to the taste skill

Each goes into the AGENTS.md Decision Log in the phase that ships it:

1. **No hero photograph** (Phase 3): listings are the imagery; a stock campus photo would be fake and GMI-flavoured.
2. **Legal em-dashes kept** (Phase 7): rule 11.F outranks rule 9.G for legal copy.
3. **CSS-only motion** (Phase 1): Decision Log 2026-08-15 declined an animation library; a marketplace needs feedback motion, not choreography.
4. **Scope limited** on forms, messages and admin (above): the skill disclaims those surfaces.
5. **`PinMark` stays hand-drawn**: it is the logo, and the skill's hand-drawn-SVG ban is about icons.

## 4. Testing and verification

**Every task, before its report is accepted:** `npm test`, `npx tsc --noEmit`, `npx eslint`, `npx next build`, all clean.

**Tests that change**
- `color-contrast.test.ts`: new primitive values; asserts AA for every text/surface pair in both themes, `--on-highlight` on `--highlight`, `--action-contrast` on `--action`, and 3:1 for `--focus` against `--surface` and `--control-line` against `--surface-raised` (non-text contrast). `--line` is exempt: in dark mode it is a decorative card edge, not a control boundary. The test reads the primitive values from `globals.css` rather than keeping its own copy, so the two cannot drift.
- `icon.test.ts`: new baked colours in `icon.svg`.
- `theme.test.ts`: keeps passing unchanged (it ties `THEME_ATTRIBUTE` to the stylesheet's `[data-theme]` selectors).
- `listing-labels.test.ts` / `browse-board.test.ts`: meta-line split, if `listingMetaParts` changes shape.
- `site-copy.test.ts`: the em-dash assertion (Phase 8).

**New tests**
- A tokens test reading `globals.css`: every semantic colour token's value contains only `var(--brand-…)` references (and `light-dark()`), never a literal colour. This is what keeps the GMI swap a one-file edit.
- `currentSection(pathname)`: every section, nested paths, unknown paths.

**Build-output checks (known traps)**
- Any new CSS class: grep the **compiled** CSS at `.next/static/chunks/*.css` (print the path first; Gotcha #47). `light-dark()` is polyfilled by the build, so check compiled `[data-theme=dark]` rules, unquoted, not the literal function.
- Fonts: `.next/static/media/*.woff2` exists and nothing in the built output requests `fonts.gstatic.com` (Gotcha #46).
- `icon.svg`: `python3 -c "import xml.dom.minidom; xml.dom.minidom.parse('src/app/icon.svg')"` (Gotcha #51).
- Mutation-test new guards (tokens test, em-dash test) **after committing** (Gotcha #50).

**Visual verification (every phase)**
- Headless Chrome is available (`google-chrome --headless=new --screenshot`). At the end of each phase, against `next dev` or `next start`, capture each signed-out page in light and dark (force with `data-theme`) at 375 and 1280 wide, and review them before asking the builder.
- The builder walks signed-in pages before merge: inbox, thread, `/listings/mine`, edit, admin. The dev database should contain at least one photoless listing, a rental, a service and a sold listing so every card state renders.

## 5. Workflow

- Per phase: an implementation plan via `superpowers:writing-plans` in `docs/superpowers/plans/2026-09-27-overhaul-phase-N-<name>.md`, then execution via `superpowers:subagent-driven-development`.
- **Implementers are Sonnet 5 subagents** (`model: "sonnet"`), one fresh subagent per task. Each brief contains: the spec section for that task, the reference file path, the applicable taste-skill rules and pre-flight items, the relevant Known Gotchas by number, and the exact verification commands. The implementer reports its diff summary and verification output; **Opus reviews against this spec** and either accepts or returns specific fixes before the next task starts.
- One branch and one PR per phase: `feature/overhaul-1-foundation`, `feature/overhaul-2-chrome`, and so on. Phases merge in order; each is independently shippable.
- Each phase updates AGENTS.md (Current State, Decision Log, Next Steps, any new gotcha) as that file requires.

## 6. Risks

- **Phase 1 changes every page at once**, since every page uses the shared classes. That is intended, but it means Phase 1's screenshot pass covers the whole signed-out site, not only the pages Phase 1 "owns".
- **Yellow in light mode** is easy to misuse as text or a thin line. The contrast test covers token pairs, not arbitrary utilities, so review each diff for `text-[highlight]`-style misuse.
- **The mobile dropdown** is the first header element drawn over page content; z-index must use the documented layer (header) rather than an ad-hoc value, and the thread page must be checked with it open.
- **The GMI swap** assumes GMI's palette fits the same roles. GMI's red cannot be `--highlight` (it collides with `--danger`), so a swap will need its own small design decision, not only new values.
