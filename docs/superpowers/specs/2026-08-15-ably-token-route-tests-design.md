# Tests for the Ably token route

**Date:** 2026-08-15
**Status:** Approved, implementing
**Branch:** `feature/ably-token-tests`
**Extends:** `docs/superpowers/specs/2026-08-15-conversations-db-tests-design.md`

## The problem

`/api/ably/token` is where the messaging security model actually lives. Its own
doc comment states the property the whole feature rests on:

> No token ever carries `publish` on a conversation channel. Clients get
> `subscribe` and `presence` only [...] A stolen or tampered token therefore
> cannot forge a message — the ability simply isn't in it.

That claim is currently backed by **one manual probe against the live Ably
service on 2026-08-14**, which nobody can re-run and which is not attached to the
code. If somebody adds `"publish"` to that array tomorrow, nothing fails.

The conversation-authorization work covered `getParticipantsIfMember`, which the
route calls. It did not cover what the route *does with the answer* — the
capability object, the client identity binding, or the four status codes.

## Why it was untestable, and what changed

The previous spec built a harness that resolves `server-only` and the `@/*`
alias. Two further obstacles were found by probe:

**Next ships no `exports` field at all.** `import { NextResponse } from
"next/server"` therefore relies on CommonJS extension resolution, which ESM does
not do, and fails with `ERR_MODULE_NOT_FOUND ... Did you mean "next/server.js"?`
This is unrelated to the `react-server` condition and is the real reason no route
handler in this project has ever had a test. Fixed with a one-line shim in the
resolve hook mapping `next/server` to `next/server.js`, which was verified to
import and to produce a working `NextResponse.json`.

**ESM caches the route module, so per-test mocks go stale.** A `t.mock.module`
inside each test appears to work and does not: the route module is imported once
and closes over whichever mock was active then. A probe showed the second test
receiving `401` while supplying a valid session. The suite therefore installs
**one** `mock.module("@/auth")` at module scope, reading a mutable `session`
variable that each test assigns. This is a property of ESM, not of the mocking
API, and would affect any future route suite the same way.

## Approach

`mock.module` from `node:test`, behind `--experimental-test-module-mocks`.

Chosen over redirecting `@/auth` through the resolve hook, which needs no
experimental flag but teaches the shared harness about one specific application
module — bespoke, and it does not generalise to the next module needing a fake.
The flag is a Node CLI option rather than a dependency, so the zero-dependency
constraint (Decision Log 2026-08-12) is untouched. If a future Node release
changes the API the suite fails loudly, which is the acceptable failure mode.

`ExperimentalWarning` is silenced in the script for the same reason
`MODULE_TYPELESS_PACKAGE_JSON` is (Gotcha #22): it is printed on every run and
carries no information after the first.

**Only `@/auth` is faked.** The database is real, `getParticipantsIfMember` is
real, and the Ably client is real. Token signing was measured at **10ms** and is
pure local HMAC — `createTokenRequest` does not contact Ably unless `queryTime`
is set, which it is not. The suite therefore consumes no free-tier quota and
cannot be flaky on network.

## What is asserted

**Rejection**

1. No session → `401`.
2. A session with no `user.id` → `401`.
3. A session id that is not a safe channel id → `400`.
4. `conversationId=*` → `400`. Wildcard injection is the specific attack the
   guard exists to stop: Ably capabilities are channel-name patterns.
5. `conversationId` containing `:` → `400`.
6. A conversation the caller does not participate in → `404`.
7. A conversation that does not exist → `404`, and **byte-identical** to case 6.
   The route's comment says distinguishing them would confirm the existence of
   other people's conversations.

**Capability**

8. With no `conversationId`, the capability is exactly
   `{ "user:<id>": ["subscribe"] }` — nothing else, and subscribe only.
9. As a participant, the conversation channel carries exactly
   `["subscribe", "presence"]`.
10. **No capability value in any scenario contains `publish`.** Asserted by
    scanning every value of the parsed capability across all responses, so it
    keeps holding for capabilities added later.
11. `clientId` equals the session user id, so presence reports an identity the
    client cannot choose.
12. `Cache-Control: no-store` is set — a cached token is a token shared between
    users of a proxy.

## Mutation testing

| Mutation | Test that must fail |
|---|---|
| `["subscribe", "presence"]` → `["subscribe", "presence", "publish"]` | 10 |
| The `isSafeChannelId(conversationId)` guard removed | 4 |
| The `!participants` → `404` early return removed | 6 |

A control that has never been observed failing is only an assumption.

## Out of scope

`/api/upload` remains untested. It needs the same session fake plus multipart
request fixtures, and is a separate suite. The harness work is done either way.
