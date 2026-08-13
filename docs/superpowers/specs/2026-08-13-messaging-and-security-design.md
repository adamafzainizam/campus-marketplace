# Design: real-time messaging + security hardening

**Date:** 2026-08-13
**Status:** Approved
**Scope:** Weeks 5-6 messaging (Ably), plus remediation of security findings in the existing codebase

---

## Part 1 — Security audit of existing code

Six findings. Each was verified against a running server rather than inferred from reading code; two proved milder than they first appeared, and that is recorded honestly below.

### S1 — No rate limiting anywhere (HIGH)

Any authenticated user can call `/api/upload` in a loop, minting unlimited presigned URLs and uploading unlimited 5MB objects. R2's free tier is 10GB — roughly 2,000 uploads. Known Gotchas #8 records that Cloudflare has no hard spending cap, so the $1 budget alert is the only tripwire and it fires *after* billing begins.

**Verified:** 30 rapid POSTs to `/api/upload` returned `401` thirty times and zero `429`s — no rate limiting exists at any layer, which also means no brute-force protection anywhere.

This is the finding that most directly threatens the project's standing no-spend constraint.

### S2 — Orphaned R2 objects (MEDIUM)

The browser uploads to R2 *before* `createListing` runs. If the user abandons the form or server-side validation rejects the listing, the object remains in R2 with no row referencing it: unbounded storage growth against a 10GB ceiling, and the abandoned image stays publicly readable at its `r2.dev` URL.

### S3 — Server actions do not validate input types (MEDIUM)

`createListing` calls `input.title.trim()` before establishing that `title` is a string. A direct POST of `{"title": null}` throws an unhandled `TypeError`, producing a 500 rather than a clean 400 and leaking a stack trace in development. `categoryId` flows into `findUnique` with the same absence of a type guard.

Next.js's own guidance for this version is explicit: *"Treat FormData, query parameters, and headers as untrusted."*

### S4 — No security headers (MEDIUM)

**Verified absent:** `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`. `next.config.ts` is still the empty scaffold. Clickjacking works today.

### S5 — Over-fetching user records (LOW, latent — not a live leak)

`include: { seller: true }` selects every `User` column, including `email` and `emailVerified`.

**Verified NOT currently leaking:** the rendered payload of a listing detail page was searched for any email address and for the strings `emailVerified` and `gmi.edu.my`; none appear. The page is a pure Server Component, so only rendered output crosses to the browser.

It becomes a genuine leak the moment that object is passed into a Client Component. Fixed as defense-in-depth, not as an active vulnerability.

### S6 — Unbounded `findMany` (LOW)

The browse page has no `take`. Already tracked as deferred pagination, but it is also a resource-exhaustion path as data grows.

### Verified clean

No secrets tracked or ever committed; `.env*` correctly ignored; no hardcoded credentials in tracked files; CSRF covered by the framework's Origin/Host check; Prisma parameterizes the search query, so there is no injection path.

---

## Part 2 — Remediation design

### Rate limiting (S1)

A `RateLimit` table in Postgres, keyed `"<action>:<userId>"`, holding a count and a window expiry.

```prisma
model RateLimit {
  key       String   @id
  count     Int      @default(0)
  windowEnd DateTime
  @@index([windowEnd])
}
```

**Why Postgres and not an in-memory `Map`:** Week 7 deploys to Vercel, where consecutive requests may hit different serverless instances and instances cold-start freely. An in-memory counter gives an attacker a fresh budget per instance — it would look like protection while providing almost none. Postgres is shared across instances, already a dependency, and already free.

Rejected Upstash Redis: better at this job in the abstract, but it adds an account, two dependencies, and a service that can start billing — against the standing no-spend constraint.

Limits (per user, per rolling window):

| Action | Limit |
|---|---|
| `upload` — mint presigned URL | 20 / hour |
| `listing` — create listing | 10 / hour |
| `message` — send message | 60 / minute |
| `conversation` — start conversation | 20 / hour |

The window is advanced with a single atomic `upsert`, so two concurrent requests cannot both read a stale count. On limit exceeded, API routes return `429`; server actions throw a message the UI surfaces.

### Input validation (S3)

`createListing`'s rules move out of the server action into `src/lib/listing-constraints.ts` as pure, exported functions with explicit type guards — every field checked as `typeof === "string"` before any method call.

This also closes the item AGENTS.md Next Steps named as the highest-value untested gap; the extraction was already worth doing on its own merits, and it makes the rules testable with the harness built on 2026-08-12.

### Security headers (S4)

Set in `next.config.ts` via `headers()`:

| Header | Value | Reason |
|---|---|---|
| `X-Frame-Options` | `DENY` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME confusion |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Unused capabilities |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Downgrade attacks |
| `Content-Security-Policy` | see below | XSS defense-in-depth |

CSP must allow: `self`, the R2 public host for images, and the Ably endpoints for `connect-src` (`wss://*.ably.io`, `https://*.ably.io`). `'unsafe-inline'` is required for styles under Tailwind. Scripts use `'self'` plus `'unsafe-inline'` — Next.js's inline bootstrap needs it without a nonce, and a nonce requires middleware that would opt every route out of static rendering. That trade-off is recorded here deliberately rather than left implicit.

### DTO selects (S5) and bounded queries (S6)

Every query that loads a `User` alongside other data switches from `include` to an explicit `select` naming only rendered fields. The browse query gains `take: 60`.

---

## Part 3 — Messaging design

### Conversation model

One thread per `(listing, buyer)` pair — the model eBay, Carousell, and Facebook Marketplace all use. "Is this still available?" is never ambiguous, and a sold or deleted listing scopes cleanly to its own threads.

The seller is **not** duplicated onto `Conversation`; it is derived from `listing.sellerId`. "My conversations" is therefore `buyerId = me OR listing.sellerId = me`.

```prisma
model Conversation {
  id        String   @id @default(cuid())
  listingId String
  buyerId   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt   // bumped per message → inbox ordering

  listing  Listing @relation(fields: [listingId], references: [id])  // Restrict
  buyer    User    @relation(fields: [buyerId], references: [id])    // Restrict
  messages Message[]
  reads    ConversationRead[]

  @@unique([listingId, buyerId])
  @@index([buyerId])
  @@index([updatedAt])
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  senderId       String
  body           String   @db.Text
  createdAt      DateTime @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender       User         @relation(fields: [senderId], references: [id])

  @@index([conversationId, createdAt])
}

model ConversationRead {
  conversationId String
  userId         String
  lastReadAt     DateTime @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([conversationId, userId])
}
```

**`onDelete: Restrict` on `Conversation → Listing`** matches the schema's existing philosophy (Listing's own relations use `Restrict`): deleting a listing that has live conversations should force an explicit decision rather than silently destroying message history. This turns the Week 7 edge case "deleted listing with an active conversation" into a database-enforced prompt.

**`ConversationRead` as a table rather than two columns** (`buyerLastReadAt` / `sellerLastReadAt`): there are only ever two participants, so columns would work, but every read and write would need an "am I the buyer or the seller?" branch — and that conditional is exactly where unread-count bugs live. A row per participant keeps the logic role-agnostic.

### Write path — server-authoritative

Client calls a server action → the action verifies the caller participates in the conversation → writes to Postgres → the server publishes to the Ably channel → both clients receive it over their subscription.

Rejected alternatives: the client publishing to Ably directly while the server persists separately (two authorities that can diverge; a client could publish content that never reaches the DB), and an Ably integration webhook writing to the DB (more moving parts, harder to test, no benefit at this scale).

This yields the property the whole design rests on:

> **Clients never receive `publish` capability on message channels.** They get `subscribe` and `presence` only. A message can enter a channel only from the server, after a database write by a verified participant. A stolen or tampered client token cannot forge a message.

That is Known Gotchas #17's lesson — never trust what the browser hands back — applied at the architecture level rather than patched in afterwards.

The cost is that the sender's own message round-trips through the server before appearing. Optimistic UI covers it.

### Ably: retention and the source of truth

The free tier retains messages for **1 day**. Ably therefore cannot be the store of record; Postgres owns all history and Ably is purely live fan-out. This was going to be the right architecture regardless, but it is now a hard constraint rather than a preference.

Free-tier headroom (verified 2026-08-13): 6M messages/month, 200 concurrent connections, 200 concurrent channels, 500 msg/s, 64KiB max message, no credit card required.

### Channels and capabilities

| Channel | Client capability | Purpose |
|---|---|---|
| `user:<userId>` | `subscribe` | Unread badges across all threads |
| `conversation:<id>` | `subscribe`, `presence` | Thread messages, online/in-chat |

`/api/ably/token` mints a token scoped to the caller: always their own `user:` channel, plus `conversation:<id>` only after a database check confirming they are the buyer or the listing's seller. Requesting a conversation they are not part of returns 403 and the token does not carry the capability.

The Ably API key is server-only and never reaches the browser. It is read from `ABLY_API_KEY`, which is deliberately **not** prefixed `NEXT_PUBLIC_`.

### Message safety

Bodies are rendered as text through JSX, so React escapes them. `dangerouslySetInnerHTML` must never be introduced on this path. Body rules live in `src/lib/message-constraints.ts` as pure functions: non-empty after trim, maximum 2000 characters, and a type guard before any string method.

### Files

| File | Purpose |
|---|---|
| `src/lib/rate-limit.ts` | Postgres-backed limiter |
| `src/lib/listing-constraints.ts` | Extracted listing validation (pure) |
| `src/lib/message-constraints.ts` | Message body rules + channel naming (pure) |
| `src/lib/ably.ts` | Server-side Ably REST client |
| `src/lib/conversations.ts` | Data access: participation checks, DTO shaping |
| `src/app/api/ably/token/route.ts` | Capability-scoped token endpoint |
| `src/app/messages/page.tsx` | Inbox |
| `src/app/messages/[id]/page.tsx` | Thread (server) |
| `src/app/messages/[id]/MessageThread.tsx` | Thread (client, Ably subscription + presence) |
| `src/app/messages/actions.ts` | `startConversation`, `sendMessage`, `markRead` |

### Testing

New pure modules get suites using the existing harness: `listing-constraints`, `message-constraints`, and the rate limiter's window arithmetic. Security-relevant tests are mutation-tested — the fix reverted, the test confirmed to fail — as established on 2026-08-12.

---

## Out of scope

- **Typing indicators** — dropped by explicit decision to conserve message quota.
- **Full orphan-object cleanup (S2)** — rate limiting bounds the cost, and a `PendingUpload` tracking table plus a cleanup script are included, but *scheduled* cleanup needs a cron. Wiring it to Vercel Cron is a Week 7 item.
- **Blocking / reporting users** — real moderation need for a marketplace, but not part of the 8-week plan.
- **Message editing and deletion.**
