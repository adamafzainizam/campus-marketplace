# Design: legal pages, footer, and licence

**Date:** 2026-08-15
**Status:** Approved
**Scope:** Terms of Service, Privacy Policy, Acceptable Use Policy, and an affiliation disclaimer, served as real routes; a site-wide footer to reach them; a consent line on sign-in; an MIT licence for the repository.

> Not legal advice. These are drafts based on common practice, written by an AI agent and reviewed by the builder. They are proportionate to a free, non-commercial student project. They would need a real review before the site takes money — which is one of the reasons advertising was declined.

---

## Why this exists

The builder raised it directly: there is no protection for them or for any future collaborator if something goes wrong, and a specific worry that GMI might conclude the project presents itself as an official institutional service.

That worry is well founded, and the codebase was actively making it worse. `layout.tsx` titles the site **"GMI Campus Marketplace"** on every tab, with a source comment reading *"this is GMI's marketplace, not a campus marketplace in the abstract."* Sign-in is restricted to institutional accounts. Nothing anywhere corrected the impression that the institute runs it.

## The decision that shaped the rest

Three things the builder wanted point in opposite directions: a disclaimer of affiliation, a domain containing "GMI", and advertising. Each step increases the exposure the first is meant to reduce, and commercial use of an institution's name is treated far less forgivingly than a free student project.

Resolved as:

- **Legal pages: build now.** Useful whatever else happens.
- **Domain: ask GMI first**, before spending anything. Draft at `docs/gmi-permission-request.md`.
- **Advertising: declined**, recorded in the Decision Log with reasoning.

## Structure

Four documents at `/legal/<slug>`, plus an index at `/legal`.

| Route | Carries |
|---|---|
| `/legal/terms` | The venue clause — not a party to transactions, no payment handled, no items inspected. Plus warranty disclaimer, liability limits, Malaysian governing law |
| `/legal/privacy` | PDPA-shaped: what is collected, why, the named processors, cross-border transfer, retention, access and correction rights |
| `/legal/acceptable-use` | Prohibited items and conduct, enforcement, reporting route |
| `/legal/disclaimer` | Independence from GMI, and a direct invitation for GMI to raise concerns |

The "liability waiver" the builder asked for lives inside the Terms rather than becoming a fifth page. Malaysian consumer protection law limits what can be disclaimed, so the text says what it can honestly say and no more.

**The Acceptable Use Policy leads with academic integrity** — no exam papers, no completed assignments, no assignment-writing services. That section is specific to a campus marketplace, and it is the single most reassuring thing on the site if GMI ever reads it.

## Implementation

- `src/lib/legal.ts` — contact address, effective date, the disclaimer sentence, and the document registry. Four places need to agree about these (footer, pages, sign-in, index); naming them four times is how they drift. Same reasoning as `upload-constraints.ts`. Pure, so it is tested directly: 18 tests, including the prototype-chain guard from Known Gotchas #15, since `findLegalDocument` takes a string that may come from a URL.
- `src/app/legal/layout.tsx` — narrower measure than the rest of the site. A grid wants width; a document wants a readable line length.
- `src/app/legal/LegalDocumentPage.tsx` — shared chrome, so the date and contact line cannot drift between documents.
- `.prose` added to the `@layer components` block in `globals.css`, alongside `.btn`/`.field`/`.chip`. Nobody reads terms front to back; they skim for one clause, so headings outrank body text by colour as well as size.
- `src/components/SiteFooter.tsx` — disclaimer, four links, contact, source link. Not sticky and not translucent, unlike the header: a header is a control surface reached for mid-task, a footer is an endnote.
- Sign-in gains a consent line *above* the fold and *before* the account picker.
- `LICENSE` (MIT) and `"license": "MIT"` in `package.json`. Without one the repo is all-rights-reserved by default, so no collaborator can legally contribute.

## The one real risk, handled

Known Gotchas #33: adding the site header broke the conversation thread, because that page sizes itself to the remaining viewport and scrolls its own message list. **A footer is the same class of change** — anything consuming vertical height competes with a view that wants all of it. On a phone the footer would take roughly a third of the conversation.

So the thread opts out: it carries a `.thread-viewport` marker class, and `body:has(.thread-viewport) > footer { display: none }`. `:has()` rather than restructuring the root layout into sibling route-group layouts, which is a lot of rearrangement to relocate one element. The marker is on the loading skeleton too, so the footer does not flash in mid-navigation.

This is the gotcha being caught *before* it shipped rather than after, which is the first time that has happened in this project.

## Verified

Build passes with all five new routes. 191 tests (up from 173). `tsc` and `eslint` clean. Against a running server: every legal route returns 200, the disclaimer appears on the home page, the consent line on sign-in, all four footer links resolve, and the `:has()` rule is present in the compiled stylesheet.

**Not verified:** the thread page with the footer suppressed, in a browser. It needs a signed-in session, so it is on the builder's manual list.

## Out of scope

The domain migration, advertising, an in-app reporting button (the AUP says plainly that there isn't one and gives an email instead), and a cookie consent banner — which is not needed, because the only cookie is the strictly-necessary session cookie. That last point is itself an argument against ads: an ad network would set tracking cookies and require a consent mechanism to be built.
