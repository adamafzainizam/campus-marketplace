# Design: Week 8 case study

**Date:** 2026-08-15
**Status:** Approved
**Scope:** `docs/case-study.md` — the written case study called for by Week 8 of the build plan. Prose only; no code changes.

---

## What this is for

The 8-week plan asks for "a short case study covering the problem, the architecture decisions, and one thing that would be improved with more time." Its audience is a recruiter or hiring engineer who has clicked through from the README, and who will decide within a screen or two whether to keep reading.

The README already covers *what the app does* and *how to run it*. The case study must not repeat either. Its job is to show **how decisions were made**, which is the thing a screenshot cannot demonstrate.

## Decisions taken before writing

| Question | Decision | Why |
|---|---|---|
| Where it lives | `docs/case-study.md`, linked from the README | One hop from the repo landing page, version-controlled beside the code it describes, costs nothing |
| Emphasis | Production failures are the centrepiece, not a postscript | Every junior portfolio claims everything worked. A candidate who can dissect their own outage reads as someone who has shipped. The material is also unusually good — three outages from one policy |
| The unverified test | Stated plainly, alongside what *is* proven | The document's whole argument is "verify rather than assume". Quietly omitting the one unverified thing would undercut it |
| Screenshots | Out of scope | They need a browser against the live site. A shot-list is delivered instead so adding them later is mechanical |
| Structure | Problem → decisions → what broke → what I'd change | Rejected chronological (buries the best material at the end) and ADR-style (`AGENTS.md` already is that, in more detail) |

## Structure

Target ~1,800 words.

**1. The problem** (~150 words). No campus channel for secondhand items; it happens in ad-hoc WhatsApp groups where nothing is searchable and nobody is verified. The trust problem is the interesting half, and it is solved structurally — domain-restricted sign-in — rather than with a review system. Names the two constraints that shaped everything: no money spent anywhere, and 10–15 hrs/week solo for 8 weeks.

**2. Architecture decisions** (~450 words). Four, chosen because each had real tension. No "chose TypeScript because types are good."

- Ably over self-hosted Socket.io, and the 1-day free-tier retention that forced Postgres to be the store of record — a constraint that improved the design.
- Clients are never granted `publish` capability. Verified against live Ably: error `40160`.
- Rate limiting in Postgres rather than an in-memory `Map`, because Vercel cold-starts fresh instances and an in-memory counter hands an attacker a fresh budget per instance.
- Two R2 buckets — recorded as a *reversal*, since one bucket was correct until the cleanup cron landed and made it a data-loss path.

**3. What broke in production** (~700 words — the centrepiece). Four bugs, each given the symptom, the wrong thing it resembled, and the actual cause:

1. `form-action 'self'` silently blocked the OAuth redirect; sign-in did nothing at all.
2. `connect-src` missing R2's API host — blocked before the request left the browser, so no preflight was sent and every CORS check passed while uploads stayed broken.
3. The fix for #2 allowed the wrong host: the AWS SDK addresses R2 virtual-hosted style, and CSP host matching does not cross subdomains.
4. Next.js masks thrown server-action errors in production, making a validation message and a crash indistinguishable.

Then the thread: three of the four came from one security policy, and every path it broke had last been exercised the day *before* that policy landed. Two rules extracted — after tightening a CSP, walk every outbound request the browser makes rather than only page loads; and more generally, a policy or error-handling choice invisible in development is precisely the kind that ships broken.

A shorter fifth item, different in kind: the `.vercel.app` name collision — an assumption about the environment rather than a bug in code.

**4. A constraint I measured instead of guessing** (~200 words). Warm TTFB 0.30–0.56s; first request after idle 7.3s, from Neon auto-suspend. Query tuning cannot fix a sleeping database and the free tier has no always-on option, so the response was to make the wait legible — skeletons plus `useLinkStatus` on the clicked element, because "did my click register" is a different question from "is something loading".

**5. What isn't verified** (~120 words). Two-session real-time delivery. States the three things that *are* proven and why they do not add up to the end-to-end claim.

**6. One thing I'd do differently** (~180 words). Automated tests for the authorization layer: `src/lib/conversations.ts` decides who may read a conversation, has been verified by hand against the database, and is the only module in `src/lib/` without a test. Pagination and moderation get one line each as known gaps, not as the headline.

## Also delivered

- README links to the case study.
- A screenshot shot-list: which pages, which state, phone vs desktop, target paths, and the Markdown to paste.
- `AGENTS.md` updated per its own standing instruction.

## Out of scope

The screenshots themselves, the two-session delivery test, and any code change.
