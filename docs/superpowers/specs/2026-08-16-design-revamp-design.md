# Design revamp — "student-made, and proud of it"

**Date:** 2026-08-16
**Status:** Approved, not yet implemented
**Supersedes nothing.** Extends the design system built in PR #17 rather than replacing it.

## The problem, as diagnosed

The builder reported feeling "meh" about the UI/UX. Pressed on what that meant, three of
four candidate causes were selected:

- **Correct but characterless** — nothing is wrong; it looks like every other AI-built app.
- **Looks unfinished or amateur** — spacing and consistency problems.
- **Feels empty and lifeless** — the site looks barren.

Explicitly **not** selected: "confusing or awkward to use". Navigation and flows are fine,
so nothing is restructured. This is a surface problem, and treating it as an information-
architecture problem would be a waste.

## The principle

The site exists because buying and selling at GMI happens in WhatsApp and Telegram groups,
official and unofficial, where a listing is buried within twenty minutes, there is no
search, photos compress to mush, and the same "WTS calculator, still available?" scrolls
past four times a week. The product's whole argument is that **this stuff should have
somewhere to live**.

So the voice is that of someone who got tired of the group chats and built the alternative:
direct, faintly exasperated with the status quo, specific about campus life. The test for
every change is *would a GMI student find this charming, or embarrassing?*

**This also serves the legal position.** A site that visibly reads as a student project is
the strongest available evidence that it is not an official GMI service — which is exactly
what `AFFILIATION_DISCLAIMER`, the four legal pages, and the pending GMI letter exist to
establish. A more polished, institutional look would *increase* the risk they manage.
Looking corporate is a hazard here, not a goal.

## Decisions

### Typography — Space Grotesk (display) + Inter (body)

Chosen from three rendered pairings. Space Grotesk's slightly technical letterforms read as
engineering-student rather than art-student, which suits both the builder and the audience.

The current font is **Geist** — Vercel's own typeface, and about as close to a default
AI-app signature as a typeface gets. Replacing it is the single highest-impact change
available against "characterless".

Both load through **`next/font/google`**, which downloads and self-hosts at build time.

### Accent — violet

| Token | Light | Dark |
|---|---|---|
| `--accent` | `oklch(52% 0.20 295)` | `oklch(72% 0.17 295)` |
| `--accent-hover` | `oklch(46% 0.19 295)` | `oklch(78% 0.15 295)` |
| `--accent-subtle` | `oklch(95% 0.04 295)` | `oklch(30% 0.08 295)` |
| `--accent-contrast` | `oklch(99% 0 0)` | `oklch(16% 0.01 295)` |

Two hues were excluded on **systems** grounds rather than taste: `--success` already owns
green (hue 155) and `--danger` owns red (hue 25). An accent near either means "saved
successfully" and "this is a link" become the same signal. Violet sits furthest from
everything already in the system, so there are no semantic collisions, and it holds up
unusually well on dark surfaces.

The single-accent decision from PR #17 stands: a marketplace's colour should come from the
photographs.

### Layout — structured page

Headline band → category rail → grid. The point is that **the grid stops being the whole
page**. Four listings then sit inside a designed page rather than floating in white, which
is the actual fix for "empty" — emptiness here is a structure problem, not a content one.

Grid columns: **2 below `sm`, 3 at `md`, 4 at `lg`** (Tailwind defaults: 640 / 768 / 1024px). Two
columns on a phone rather than one — a single-column feed of large cards is what makes four
listings feel like an endless empty scroll.

### Spacing scale

"Looks amateur" was diagnosed as a consistency problem, and leaving the scale vague would
reproduce it. One scale, no ad-hoc values:

| Step | Value | Used for |
|---|---|---|
| `2xs` | `0.25rem` | icon/text gaps |
| `xs` | `0.5rem` | inside chips, badges |
| `sm` | `0.75rem` | card padding, grid gaps on phone |
| `md` | `1rem` | card padding on desktop, grid gaps |
| `lg` | `1.5rem` | between page sections on phone |
| `xl` | `2.5rem` | between page sections on desktop |
| `2xl` | `4rem` | above/below major page bands |

Anything not on this scale is a bug. The rule that matters more than the numbers: **the gap
between two things must be smaller than the gap to the next group.** Most "amateur" spacing
is uniform spacing, which destroys grouping.

The noticeboard *surface* (board texture, pinned cards) was shown and **not** chosen. The
noticeboard idea survives only where it is free: in language, and in an empty state that
reads as an empty board rather than a centred grey sentence. No texture, no pushpins.

### Voice

Five rules:

1. **Personality belongs in states of possibility, never states of friction.** Empty states,
   success, first-run — wry is welcome. Errors, validation, upload failures, suspension
   notices — dead plain. A joke when someone's upload just failed is obnoxious.
2. **Specific beats generic.** Calculator, lab coat, mini fridge, hostel. Specificity *is*
   character and costs nothing.
3. **Second person, present tense.**
4. **Four topics stay sober, always:** money, halal, suspension, safety. `halalDisplayLabel`
   attributes every claim to the seller as a legal and ethical position; nothing there gets
   clever.
5. **No exclamation marks.** Cheap enthusiasm is a reliable AI tell.

Agreed strings:

| Where | Now | Becomes |
|---|---|---|
| Home headline | *(generic)* | "Buy, sell and rent around GMI." / "Without it buried in a group chat." |
| Search placeholder | "Search listings" | "Books, clown nose, time machine…" |
| Home, nothing posted | "Nothing has been posted yet. Be the first." | "Nothing posted yet. Be first — it'll still be here next week, which is more than the group chat can manage." |
| Home, filtered empty | "Nothing matches those filters yet…" | *unchanged* — friction, not possibility |
| Inbox empty | "No conversations yet. Message a seller from a listing to start one." | "No conversations yet. When someone wants your stuff, it lands here — not buried under forty messages." |
| `/listings/mine` empty | "You haven't posted anything yet." | "Nothing posted yet. Takes about a minute, and photos do most of the work." |
| Upload failure | *(plain)* | *unchanged* — friction |

The placeholder joke is **absurd, not illicit** — a gag about a *banned* item would undercut
the Acceptable Use Policy; one about an impossible item costs nothing. It also truncates
gracefully on a narrow phone to "Books, clown nose, tim…", so the funny part survives.

## Guardrails

Non-negotiable, and verified rather than assumed.

1. **Fonts must be self-hosted.** The CSP has caused three production outages already
   (Gotchas #31, #34). A `<link>` to `fonts.googleapis.com` would be the fourth.
   `next/font/google` keeps everything inside `'self'`. Re-check the CSP after the change,
   and re-run `src/lib/security-headers.test.ts`.
2. **Gotcha #36 is live here.** `globals.css` silently overrode the loaded webfont with
   Arial for the project's entire life, invisibly, because Arial is unremarkable rather than
   obviously wrong. Verify the **computed** `font-family` in a browser, not that the build
   passed.
3. **The perceived-performance work survives intact.** `loading.tsx` on every route,
   `PendingLink`/`useLinkStatus`, the skeletons. This is the answer to a 7.3s Neon cold
   start, not decoration. **Skeletons must be updated to match new layouts** — a skeleton
   that flashes the wrong shape is worse than none.
4. **The thread page's height contract holds.** The `min-h-0` flex chain and
   `body:has(.thread-viewport) > footer { display: none }` (Gotchas #33, #37). This has
   broken twice already from changes made elsewhere. Check the thread after touching the
   root layout or `globals.css`.
5. **Legal text is not edited — only presentation.** `AFFILIATION_DISCLAIMER` stays on every
   page it currently appears on. `src/lib/legal.ts`'s 18 tests stay green. Restyling a legal
   page must not change one sentence.
6. **Mobile is a first-class target, not a check at the end.** Every phase is reviewed at
   375px and 1280px before it is called done. Layouts were chosen from mockups drawn at both
   widths for this reason.
7. **The three accessibility signals stay independent** — `prefers-reduced-motion`,
   `prefers-reduced-transparency`, `prefers-contrast` (Decision Log 2026-08-15). Accent
   contrast must meet WCAG AA against its surfaces; this is measured during implementation,
   not asserted here.

## Scope

**Everything**, including `/admin` and `/legal`. The builder chose full consistency over the
recommended public-pages-only scope, having been shown that admin and legal are a large
share of the page count and near-zero of the impression.

Admin and legal get token inheritance and a light structural pass — spacing, type, headings
— and no bespoke design work and no text changes.

## Phasing

**One PR per phase**, matching the project's one-feature-one-branch rule. Each phase ends
with a working, reviewable, deployable site — so the revamp can stop after any phase without
leaving the site half-restyled.

1. **Foundation** — accent tokens, `next/font` swap, spacing scale, shared `.btn`/`.field`/
   `.chip`/`.badge` classes in `globals.css`. Everything downstream inherits. Verify computed
   font, CSP, contrast, dark mode.
2. **Home** — structured page, grid at 2/3/4 columns, empty states, headline, placeholder.
3. **Listing detail, listing form, `/listings/mine`, sign-in.**
4. **Messages** — inbox and thread. Height contract handled explicitly.
5. **Admin and legal** — inherit, light pass, zero text change.

Copy is applied within each phase rather than as a separate pass, so no page is ever left
in a half-revoiced state.

## Verification, every phase

- `npm test` (330), `npm run test:db` (29), `npx tsc --noEmit`, `npx eslint`, `npx next build`
- Reviewed at **375px and 1280px**, in **light and dark**
- Thread page checked after any root-layout or `globals.css` change
- `AFFILIATION_DISCLAIMER` still present wherever it was

## Optional: impeccable

`impeccable` is a free design-quality tool (Paul Bakaus) that lints for AI-generated design
tells and inherits existing tokens rather than overwriting them. Installed by the builder
with `/plugin marketplace add pbakaus/impeccable`. If installed, run its detector after
phase 1 and again at the end — as evidence, not as a source of direction. A linter can say
what is wrong; it cannot say what the site wants to be, which is what this spec settles.

## Out of scope

- Navigation and flows — explicitly not the problem.
- Pagination, "mark sold from the thread", and other functional gaps. Unrelated.
- Any change to legal, halal, suspension or moderation *wording*.
