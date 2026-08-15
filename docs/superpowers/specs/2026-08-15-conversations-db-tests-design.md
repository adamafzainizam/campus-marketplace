# Database-backed tests for the conversation authorization layer

**Date:** 2026-08-15
**Status:** Approved, not yet implemented
**Branch:** `feature/conversation-authz-tests`

## The problem

`src/lib/conversations.ts` is the authorization layer for messaging, and it is the
only module in `src/lib/` with no test file beside it. `docs/case-study.md` names
this as the one thing the builder would do differently, and `AGENTS.md` lists it
as the highest-value known gap.

It is untested because it is hard to test, for two reasons already recorded as
gotchas:

- It imports `server-only`, which throws when imported outside a React Server
  Component (Gotcha #24).
- It reaches `@/lib/db` through the `@/*` path alias, which `node --test` does not
  resolve — and the failure is transitive, so every module reached at any depth
  must also avoid the alias (Gotchas #21 and #23).

The three exported functions are what every caller depends on:

| Function | Used by |
|---|---|
| `getParticipantsIfMember` | `/api/ably/token`, `sendMessage`, `markRead`, `getThreadFor` |
| `listInboxFor` | `/messages` |
| `getThreadFor` | `/messages/[id]` |

`getParticipantsIfMember` is load-bearing beyond the pages: it is what decides
whether `/api/ably/token` will mint a realtime token for a channel. The security
property the entire messaging feature rests on — that a client cannot subscribe
to somebody else's conversation — is enforced by this one function, and nothing
tests it automatically.

## What this does not cover

Deliberately scoped to the three read functions in `conversations.ts`. The message
server actions (`startConversation`, `sendMessage`, `markRead`) are also
authorization-bearing, but testing them drags in `auth()` session mocking, rate
limiting and `next/navigation` — a much larger harness. The risk there is building
scaffolding instead of tests. They remain a known gap, and the harness this spec
establishes is what a later suite would reuse.

Dedicated DTO leak assertions (proving no `email` or raw `suspendedAt` timestamp
reaches a caller) were considered and left out to keep this first suite focused on
authorization. `counterpartySuspended` is asserted to be a boolean, because that is
part of the function's contract rather than an extra audit.

## Approach

Run the tests under a Node configuration that makes the real module importable,
rather than changing the module or reimplementing its queries.

Two flags do all the work:

- `--conditions=react-server` — the `server-only` package already ships a no-op
  `empty.js` behind exactly this export condition. Nothing is mocked, stubbed or
  removed; Node is simply told to resolve the package the way a server runtime
  would.
- `--import ./scripts/test-db-hooks.mjs` — registers a resolve hook mapping `@/*`
  to `src/*`, including extension resolution.

**Verified before being chosen.** A probe imported the real, unmodified
`src/lib/conversations.ts` under these two flags and got all three exports back.
The extension resolution is the part that is easy to get wrong: production code
writes `@/lib/db` with no extension, so a hook that only rewrites the prefix
resolves to a path that does not exist.

### Rejected alternatives

**Rewrite `conversations.ts` and `db.ts` to relative imports.** There is precedent
— `listing-constraints.ts` already imports the Prisma enums relatively for exactly
this reason. Rejected because it edits production code for the test's benefit,
fixes only this module, and requires the same edit again for every future module.
It spreads the problem rather than solving it.

**Replicate the queries inside the test.** This is what the manual 2026-08-14
database verification did. Rejected because it tests a *copy* of the query, which
can drift from the real one silently — the precise failure mode that motivated
centralising `upload-constraints.ts`. A green test would prove nothing about the
code that runs in production.

## Architecture

### `scripts/test-db-hooks.mjs`

Runs via `--import`, so it executes before any test module loads. Responsibilities,
in order:

1. `import "dotenv/config"` — Gotcha #1: standalone Node does not read `.env`.
2. Resolve the target database (see Safety below), refuse to continue if the
   guards are not satisfied, print the resolved host, and assign it to
   `process.env.DATABASE_URL` before `src/lib/db.ts` is ever imported.
3. Register the `@/*` → `src/*` resolve hook via `registerHooks` from
   `node:module`, trying `<path>`, `<path>.ts`, `<path>.tsx`, `<path>/index.ts`.

### `src/lib/conversations.db-test.ts`

The tests. The `.db-test.ts` suffix is what keeps the two suites apart: the
existing `test` script globs `src/**/*.test.ts`, which does not match
`.db-test.ts`. **No change to the existing `npm test` script is required**, and it
keeps its current properties — 330 tests, ~0.6s, no network, no `.env`, runs on any
checkout.

### `package.json`

```
"test:db": "node --conditions=react-server --import ./scripts/test-db-hooks.mjs --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'src/**/*.db-test.ts'"
```

`--disable-warning` for the same reason the existing script has it (Gotcha #22).

## Safety: which database gets written to

These tests create and delete rows, so targeting is a safety property rather than a
convenience.

The harness reads **`TEST_DATABASE_URL`** and **never falls back to
`DATABASE_URL`**. If it is unset the suite refuses to run and explains why. If it
is byte-identical to `DATABASE_URL` it also refuses, on the assumption that a
copy-paste has pointed the tests at the development database somebody is browsing.
The resolved database host is printed before the first test.

This is Gotcha #39 — every script here silently targets whatever `.env` says —
converted from a warning into a guard. It fails closed for the same reason
`CRON_SECRET` does: a destructive operation with a silent default is strictly
worse than one that refuses to run. Printing the host follows the precedent set by
`scripts/make-admin.ts`, which prints it because the two connection strings differ
only by a hostname nobody reads carefully.

The target is a dedicated Neon **`test`** branch off `development`. Branching is
the reason Neon was chosen over Supabase in the first place (Decision Log
2026-08-03); this is that reason paying off. It also means a crashed run cannot
leave rows in the database the builder browses in a real browser, and cannot make
fixture users appear in `/admin`.

## Fixtures

One helper builds a run-scoped world behind a `randomUUID()` prefix, so concurrent
or repeated runs cannot collide on unique columns such as `User.email`:

- three users — **seller**, **buyer**, **stranger**
- a category, a listing owned by the seller
- a conversation between the listing and the buyer, plus messages

The **stranger** is the point of the exercise: a signed-in user who participates in
nothing and must therefore see nothing.

Teardown runs in an `after()` hook so a failing assertion still cleans up, in
FK-safe order: `ConversationRead` → `Message` → `Conversation` → `Listing` →
`Category` → `User`. That order is dictated by the schema — `Listing`'s relations
are `onDelete: Restrict` by deliberate choice, so nothing cascades and every level
must be removed explicitly.

## What is asserted

**`getParticipantsIfMember`**

1. The buyer receives the participants, with `sellerId` correctly derived from
   `listing.sellerId` rather than from the conversation.
2. The seller receives identical participants.
3. A stranger receives `null`.
4. A nonexistent conversation id receives `null`.
5. Cases 3 and 4 are indistinguishable. The module's own comment claims callers
   must not be able to tell "not yours" from "does not exist", because the
   difference is itself information. Nothing currently holds that claim to account.

**`listInboxFor`**

6. The buyer sees the conversation; the seller sees it; the stranger sees none.
7. Counterparty naming flips by viewer — the buyer sees the seller's name, the
   seller sees the buyer's.
8. `unread` is true with no read row, and false once `lastReadAt` is newer than the
   last message.
9. Two conversations come back ordered by `updatedAt` descending.

**`getThreadFor`**

10. A stranger receives `null`.
11. Counterparty selection flips by viewer.
12. Messages are ordered oldest-first.
13. `counterpartySuspended` is a boolean, true when the counterparty is suspended.

## Mutation testing

The suite is verified before it is trusted, matching what was done for the Ably
channel guard, the participant check and the rate limiter. Each control is broken
in turn and the test written to catch it must be observed failing:

| Mutation | Test that must fail |
|---|---|
| `getParticipantsIfMember` returns participants without consulting `isParticipant` | 3 |
| `listInboxFor`'s `OR` clause broadened to match every conversation | 6 |
| `getThreadFor`'s early return on a null participant lookup removed | 10 |

A regression test that has never been observed failing is only an assumption that
it works. If a mutation leaves the suite green, that test is decoration and will be
reported as such rather than shipped.

## Documentation to update

- **Gotcha #24** currently states that a `server-only` module can only be reached
  by testing the pure half or replicating the query. There is a third way, and the
  entry should say so rather than continue to rule it out.
- **Gotchas #21 and #23** (the `@/*` alias, and its transitivity) are retired for
  anything run through this harness, and should say which harness.
- **A new gotcha** for the extension-resolution trap in the hook.
- **Decision Log** entry for testing the real module over the two rejected
  alternatives, and for the fail-closed `TEST_DATABASE_URL`.
- **Environment Variables** section gains `TEST_DATABASE_URL`.
- **Next Steps** — the highest-value known gap closes; the route-handler suites
  remain, now unblocked.

## Prerequisite

Creating the Neon `test` branch is a dashboard action and cannot be done by an
agent. Once it exists and `TEST_DATABASE_URL` is set, the schema must be applied to
it with `prisma migrate deploy` before the fixtures will work — a branch created
off `development` inherits its schema, but a branch created empty does not, and the
seeded categories are irrelevant either way because the fixtures create their own.

Until that branch exists the suite can be written and type-checked but not executed — and an unverified test suite is precisely what this
project argues against. Implementation therefore pauses at the point of first
execution rather than committing unrun tests.
