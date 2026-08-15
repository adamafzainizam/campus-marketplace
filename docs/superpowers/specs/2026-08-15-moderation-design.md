# Design: moderation — enforcement (PR A of two)

**Date:** 2026-08-15
**Status:** Approved, implemented
**Scope:** Roles, suspension, administrator actions, and an append-only audit log. Reporting (buttons, triage queue, scoped message viewing) is **PR B** and is not in this change.

---

## Why now

The builder asked whether the site needed moderation. It does, and for a sharper reason than "marketplaces have moderation": **the legal pages shipped the day before promise enforcement the software could not deliver.**

The Acceptable Use Policy states that listings "may be removed" and accounts "suspended or removed". Before this change the only mechanism for either was editing the database by hand through Prisma Studio. There was no role, no suspension field, no audit trail. A published policy that the software cannot carry out is not a policy; it is a promise that will be broken.

Two secondary reasons, both real:

- **It is the honest answer to GMI.** "I edit the database manually" is a weak response to "what happens when a student posts something inappropriate". "There is a moderation queue and an audit log of every action" is not.
- **It is the best remaining portfolio material.** The case study admits the authorization layer is the least-tested part of the project. Role-based access with an audit trail is authorization that is not "is this my row" — the exact gap, addressed.

The counter-argument, recorded honestly: the site has almost no users, and this is outside the 8-week plan. Building moderation for an empty marketplace would normally be premature. The published-promise problem is what overrides that.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Admin access | `UserRole` enum on `User` | Standard, demonstrable, and a second moderator can be added without a redeploy |
| Bootstrapping | `npm run make-admin -- <email>` | Roles live in the database, so something must create the first admin. A route that grants ADMIN would be a privilege-escalation endpoint permanently exposed for an operation that runs about twice |
| Suspension | Blocks writing; reading still works | Stops the harm, keeps an appeal route open, and avoids a silent lockout that reads as the site being broken |
| Message privacy | Scoped to the reported message plus context (**PR B**) | Enough to judge a report; not a licence to read private trades |
| Non-admin response | `notFound()`, never 403 | A 403 confirms the route exists |

## The two structural guarantees

**1. Every moderation write and its log row are one transaction.** No exported function in `moderation.ts` changes anything without writing a `ModerationLog` row beside it, in the same `$transaction`. A crash between them cannot leave an unlogged action. **Verified empirically**, not asserted: a deliberately-invalid log write (a foreign key to a non-existent admin) rolled the suspension back completely.

**2. Role and suspension are read from the database, never the session token.** Auth.js uses a JWT strategy here, so a claim baked into a token stays true until the token expires — a suspended user would keep writing for the life of their session, and a revoked administrator would keep their powers. One indexed lookup per privileged request buys suspension that takes effect on the *next* request.

## Structure

- `src/lib/moderation-rules.ts` — pure policy: `isAdmin`, `isSuspended`, `canModerateUser`, `validateModerationReason`, log labels. Tested directly (31 tests), because `moderation.ts` imports `server-only` and therefore cannot be imported by a test at all (Known Gotchas #24).
- `src/lib/moderation.ts` — the transactional writes and the actor lookups.
- `src/app/admin/*` — guarded area: user list, audit log. The layout guards, and **every page re-checks**, because a layout is not a security boundary in the App Router.
- `src/app/admin/actions.ts` — server actions, each re-establishing the caller's role from the database rather than trusting that they arrived through the UI.
- `scripts/make-admin.ts` — grants and revokes the role.

Listing takedown lives on the listing detail page rather than behind a search box, because you should be looking at the thing you are removing.

## Two design points worth keeping

**Admin writes get their own path.** `setListingStatus` scopes its write to `sellerId`, which is correct for a seller and *structurally* cannot act on someone else's listing. Rather than loosening that, moderation gets a separate function — the existing safety property stays intact.

**Suspension hides listings via the seller, not by changing them.** The browse query filters on `seller: { suspendedAt: null }`. Nothing has to be undone when a suspension is lifted: reinstating the person restores their listings by itself. Verified.

**`make-admin` deliberately writes no log row.** That table records actions taken through the application by an identified administrator. A change made by whoever holds the database credentials is a different kind of event, and logging it as though it came from inside the app would misrepresent it.

## Verified

- **222 tests** (up from 191). Six security controls mutation-tested — `isAdmin`, the self-moderation guard, `isSuspended`, and the three reason-validation rules — each reverted in turn and the intended test confirmed to fail.
- **Ten database-level checks against the live dev database**: suspension writes both rows; a second suspension is refused and preserves the original timestamp and reason with no extra log row; a failing log write rolls the suspension back; a suspended seller's listings vanish from browse; reinstating restores them with the listing's own status untouched; a takedown is recorded against the seller. All test data removed afterwards, confirmed by count.
- `tsc`, `eslint`, and `next build` clean, with `/admin` and `/admin/log` present.
- Migration is **purely additive** — `CREATE TYPE`, `ADD COLUMN` with defaults, `CREATE TABLE`. No `ALTER TYPE ... RENAME`, so none of the risk of the `PENDING` → `RESERVED` change.

**Not verified:** anything in a browser. The admin pages have never been rendered by a signed-in administrator, and `npm run make-admin` has not been run against any database.

---

# PR B — reporting (implemented)

Report buttons, a triage queue, and the one privileged read in the application.

## What was built

- `Report` model, keyed `@@unique([reporterId, targetType, targetId])` — one report per person per thing, because the scarce resource with one moderator is the queue, and a single aggrieved user filing fifty times buries everything else.
- `ReportReason` **mirrors the sections of the Acceptable Use Policy**, so the categories people choose from and the rules they are measured against cannot drift apart. `ACADEMIC_INTEGRITY` leads, as it does in the policy.
- Only **listings and messages** are reportable — things someone did, not people in the abstract. Every user-to-user interaction here goes through one or the other, so nothing is unreportable, and a report attached to a specific thing is something a moderator can evaluate.
- `/admin/reports` queue, **oldest first** — the opposite of the audit log, and deliberate. Newest-first quietly abandons the bottom of the queue, and the longest-unanswered report is the one most likely to have been real.
- Reporting is rate limited (10/hour) against the queue rather than against storage.

## The privacy design, which is the whole point

A moderator can read **the reported message and three either side**, and nothing else.

- The windowing is done by **two bounded database queries**, not by fetching the thread and slicing it. Messages outside the window are never read out of the database at all — slicing in memory would mean the private messages had already been read, which is exactly what the limit exists to prevent.
- Reading is **behind a button, not rendered with the page**. Reading somebody's message should be an act a moderator chooses, and since the reveal writes a log row, rendering it automatically would fill the log with views nobody meant to make and devalue every real entry.
- The log row is written **before** the content is fetched, and deliberately **not** in a transaction: a rollback would erase the record of an attempt that may well have returned data. Over-logging costs a row; under-logging costs the property the feature rests on.
- **Dismissing a report is logged too.** Deciding to do nothing is the decision an unaccountable moderator is most likely to make badly, precisely because it leaves no trace anywhere else.
- A suspended user may still file reports. Suspension exists to stop someone harming others; reporting harms nobody, and silencing it would punish everyone else for their behaviour.

## Verified

- **253 tests** (up from 222). Six new controls mutation-tested: the context-window clamp, the self-report refusal, the signed-out reporter check, the reason allowlist's prototype-chain guard, the reportable-target restriction, and the detail length cap.
- **Sixteen database-level checks** against the live dev database, the important one being the window: a 21-message thread, a report on message 10, and the query returning **exactly 7 messages spanning 07–13**, with the first and last messages of the thread confirmed *not* read. Also: duplicate reports refused while a different reporter is still allowed; the window clamping at the start of a conversation; the view logged against the message's sender; dismissal transactional; and re-closing a closed report changing nothing and writing no second log entry. All test data removed, confirmed by count.
- Migration additive — two new enums, `ADD VALUE` on two existing ones, one new table.

## The legal pages, corrected in the same PR

Both statements this PR falsified were fixed here rather than left as follow-ups:

- The Acceptable Use Policy no longer says there is no in-app reporting button; it describes the button, that you cannot report your own content, that the same thing can only be reported once by you, and that a report is a request to look rather than a verdict.
- The Privacy Policy no longer claims the moderation tools never show message content. It now states the real scope — the reported message and three either side, messages outside that window never fetched, and the read itself logged before the content is shown.

## Superseded: the original follow-up note

Report buttons, a triage queue, and scoped message viewing (`MESSAGE_VIEWED` is already in the enum and logged as a non-mutating action).

**Two statements in the live legal pages become false the moment PR B ships, and correcting them is part of that PR, not a follow-up:**

1. The Acceptable Use Policy states plainly that **there is no in-app reporting button**. True today; it must not survive the PR that adds one.
2. The Privacy Policy states that **the moderation tools do not show message content** — "there is no screen anywhere in the site that lets an administrator read a conversation they are not part of". Scoped message viewing is exactly such a screen. It will need to describe the real scope: the reported message plus a little context, never a whole thread, never an unrelated conversation, and every view written to the audit log before the content is returned.

Both were correct when written. That is the recurring trap here — a policy document is only true as of the code it was written against, and shipping a feature can falsify a sentence nobody thought to re-read.
