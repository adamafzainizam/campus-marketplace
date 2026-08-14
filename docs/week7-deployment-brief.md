# Week 7 handoff — deployment to Vercel

**Written 2026-08-14, at the end of the Weeks 5-6 session, for a fresh session to pick up cold.**

Read `AGENTS.md` first, as always. This file exists so the next session doesn't have to reconstruct where things stood.

---

## Where the project actually is

`v0.3` is tagged and `main` is green: 69 tests passing, `tsc --noEmit` clean, `eslint` clean, `next build` passing. Weeks 1-6 are complete. Nothing is half-finished in the working tree.

One gap is open and deliberately recorded rather than quietly closed: **two-session real-time delivery has never been observed.** Messaging was exercised in a single browser. The Ably transport was verified independently against the live service (a client token attempting to publish is rejected with `40160`; a server publish reaches the subscriber; presence works), and the app wiring was verified in the browser. What has not happened is those two halves meeting — nobody has watched a message land in a second browser without a refresh.

Do that test early in the next session if a second GMI account is available. A real-time bug is far cheaper to find locally than in production.

---

## Decisions to make before touching anything

These are genuine forks, not details. Each interacts with the standing no-spend constraint.

### 1. Custom domain, or `.vercel.app`?

This is the bigger question it looks like, because it reopens a deferral from 2026-08-11.

`Listing.imageUrl` stores a raw R2 object key, and `getImageUrl()` turns it into a URL using `R2_PUBLIC_URL` — currently the `r2.dev` Public Development URL. Cloudflare documents `r2.dev` as **debug-only: rate-limited, uncached, not intended for production**. The original plan was to switch to a Cloudflare custom domain at deployment, when a real domain would be bought anyway.

But the no-spend constraint says don't buy a domain. So the realistic options are:

- **Ship on `.vercel.app` and keep `r2.dev` for images.** Free, immediate, and honest for a portfolio project. Accept the rate-limiting caveat and note it in the case study as a known production trade-off — which is itself a good interview answer.
- **Find a free domain** (e.g. a student offer such as GitHub Student Developer Pack, which the builder may qualify for through GMI). Would allow a proper Cloudflare custom domain for R2 and a real URL for the README.

Recommendation: ship on `.vercel.app` first so the live link exists, and treat a domain as a later upgrade. Don't block deployment on it.

### 2. Production database: same Neon database, or a branch?

Neon's branching was cited in the Decision Log as a reason for choosing it. Options: point production at the existing database (simplest, but dev and prod then share data, and a bad local migration touches real rows), or create a Neon branch for production.

Recommendation: a separate branch for production. It is free, it is the feature Neon was chosen for, and sharing a database between local dev and a live site is the kind of thing that looks careless in a case study.

Note the existing database currently holds two test listings and one real user. Decide whether production starts empty (probably yes) and remember `npx prisma db seed` must run against it for categories, or the app renders a listing form with no categories.

### 3. Production R2 bucket, or reuse the dev bucket?

Current bucket is `campus-marketplace-images-dev` — the name says dev. Reusing it means production and development images intermingle. A second bucket is free but needs its own CORS policy and its own Public Development URL.

Recommendation: reuse the existing bucket for now, and rename or split only if it starts to matter. Two buckets doubles the CORS surface for little gain at this scale.

### 4. Orphan cleanup (audit finding S2) — now or later?

S2 is only half fixed: rate limiting bounds the cost, but an abandoned upload still leaves an R2 object nothing references, publicly readable at its URL. The real fix needs a scheduler. **Vercel Cron has a free tier**, so deployment is the natural moment.

Recommendation: do it during Week 7. A cron route that deletes R2 objects with no matching `Listing.imageUrl`, older than 24 hours. It is a small amount of work while already in the deployment context, and it closes the last audit finding.

---

## What will break in production if missed

Every one of these is already known. None should be a surprise.

1. **R2 CORS allows only `http://localhost:3000`.** Uploads will fail in production with an undebuggable `TypeError: Failed to fetch` — see Known Gotchas #14 and the triage ladder in #18. Must be set in the Cloudflare dashboard; **the scoped API token cannot do it**, it needs dashboard access or an Admin token.
2. **CSP has no production origin.** `next.config.ts` builds `img-src` from `R2_PUBLIC_URL`, so that part follows automatically, but re-check the whole policy against the deployed site with the browser console open.
3. **Every env var must be set in Vercel**: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, all five `R2_*`, and `ABLY_API_KEY`. `NEXTAUTH_URL` must be the production URL, not localhost.
4. **Google OAuth redirect URI** must include the production callback (`https://<domain>/api/auth/callback/google`) in the Google Cloud console, or sign-in fails immediately.
5. **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`** should be set to a stable value so server action references stay decryptable across instances. Next's own docs call this out for multi-instance deploys.
6. **Neon connection string and `sslmode`.** Known Gotchas #26: the `pg` driver now warns that `sslmode=require` will be treated as `verify-full`. Harmless today and stricter rather than looser, but worth confirming the pooled connection string works from Vercel.

---

## Verify after deploying

Mirror the checks already run locally, against the live site:

- Sign in with a real GMI account; confirm a non-GMI Google account is rejected
- Post a listing **with a photo** — this is the check that catches the CORS mistake
- Confirm the image actually loads on the browse and detail pages
- Open a conversation and send a message
- Confirm all five security headers are present on a production response
- Confirm `/api/ably/token` returns 401 when signed out
- Retry once before debugging anything that fails — Known Gotchas #16 (Neon cold start) and #18 (transient upload failures) both look exactly like real bugs

---

## Also queued, lower priority

- **Seller controls** — edit a listing, mark it sold. `ListingStatus` exists in the schema but nothing ever sets `PENDING`/`SOLD`. The most visible functional gap; a marketplace demo where nothing can be marked sold looks unfinished. Note it now interacts with messaging (marking sold should probably surface in the thread).
- **Pagination** — the browse grid is bounded at `take: 60`, which stops the unbounded case but is not real pagination.
- **Untested code, in priority order:** `src/lib/conversations.ts` authorization paths (highest value — it is the authorization layer, and it currently has no automated test; it was verified manually against the database instead), then the `/api/upload` and `/api/ably/token` route handlers. Both route handlers need request/session fixtures.

---

## Process reminders that have cost time before

- **Branch before writing code**, not after (Known Gotchas #12). One feature, one branch, one PR — it is an explicit learning goal, not incidental.
- **`ssh-add` after every new terminal session.** This failed three times in the Weeks 5-6 session alone, and the error message is misleading — a missing key surfaces as *"repository does not exist"*, which looks like a permissions problem. Run `eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_ed25519_new`. The proper fix (per-account key + `~/.ssh/config` host alias) is still unimplemented and would take about half an hour.
- **After any migration, verify the generated client actually updated** (Known Gotchas #2). This fired again in the Weeks 5-6 session: `prisma migrate dev` applied the migration but did not regenerate the client. Check `src/generated/prisma/models/` for the expected files.
- **Retry once before debugging a 500** (Known Gotchas #16). Neon auto-suspends; a cold start looks exactly like an application bug. This also fired in the Weeks 5-6 session — an empty listings page that was purely a cold start.
- **Read `node_modules/next/dist/docs/` before writing Next-specific code.** This version differs from training data, and the deployment and self-hosting guides are directly relevant to this phase.

---

## Suggested opening move for the next session

Read `AGENTS.md`, then this file, then resolve the four open decisions above with the builder before touching anything. The deployment itself is mostly mechanical once those are settled; getting them wrong means redoing DNS, CORS, and environment configuration.
