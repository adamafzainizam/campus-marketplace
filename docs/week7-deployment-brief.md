# Week 7 handoff brief — deployment to Vercel

**Written 2026-08-14, at the end of the Weeks 5-6 session.** Start here after reading `AGENTS.md`. This exists so a fresh session doesn't have to re-derive the state or rediscover the traps.

---

## Where the project actually is

`v0.3` is tagged and `main` is green: 69 tests passing, `tsc --noEmit` clean, `eslint` clean, `next build` passing. Weeks 1-6 are complete. Nothing is half-finished in the working tree.

Everything below is *new* work, not cleanup.

---

## Open decisions — resolve these before writing any code

These are genuine forks, not details. The standing no-spend constraint (see `AGENTS.md`) applies to all of them.

### 1. Domain: `.vercel.app` or a custom domain?

A custom domain costs money to register, and the builder's standing constraint is to finish this project without spending any. Defaulting to the free `*.vercel.app` subdomain is the consistent choice.

**This interacts with a decision deferred back on 2026-08-11.** Cloudflare documents `r2.dev` as debug-only — rate-limited, uncached, not for production — and the plan was to switch to a custom domain "at Week 7 when a real domain is set up anyway." If no domain is bought, that switch never happens and `r2.dev` becomes the production image host by default. That is a real trade-off (rate limits on image serving) and should be an explicit decision, not a silent one.

### 2. Production database: reuse the current Neon database, or branch it?

Neon's branching was cited as a reason for choosing it. Options: point production at the existing database (simple, but dev and prod share data — and dev currently holds two test listings), or create a Neon branch for production (cleaner separation, still free).

### 3. R2 bucket: reuse `campus-marketplace-images-dev`, or create a prod bucket?

The name says `dev`. Sharing it means production and development write to the same bucket.

### 4. Orphan cleanup (audit finding S2) — do it now or defer again?

Rate limiting bounds the cost but does not fix it. Vercel Cron has a free tier, which is why this was earmarked for Week 7. Doing it during deployment is cheaper than a separate trip later.

---

## Will break in production if missed

Each of these is already documented; they are collected here because they all fire at deployment.

1. **R2 CORS allows only `http://localhost:3000`.** Browser uploads will fail in production with an undebuggable `TypeError: Failed to fetch` — no server-side trace at all. Must be set in the Cloudflare dashboard, **not** via the API token (Known Gotchas #14 explains why: it's a bucket-admin operation and the scoped token gets `AccessDenied`).
2. **CSP needs the production origin.** `next.config.ts` builds `img-src` from `R2_PUBLIC_URL`, so that follows automatically, but verify after the first deploy.
3. **Every env var must be set in Vercel**, including `ABLY_API_KEY`. Names are listed in `AGENTS.md`. `ABLY_API_KEY` must **not** be prefixed `NEXT_PUBLIC_` — that would inline a full-privilege credential into the client bundle.
4. **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`** should be set and stable across instances, or server action references stop being decryptable between deploys. Next's own docs call this out for multi-instance deployments.
5. **HSTS activates in production.** `next.config.ts` sends `Strict-Transport-Security` only when `NODE_ENV === "production"`, with a two-year max-age and `preload`. That is deliberate but not trivially reversible — worth a conscious look before the first production deploy.
6. **`sslmode` on the Neon connection string.** The `pg` driver now warns that `require` will be treated as `verify-full` (Known Gotchas #26). Currently harmless and strictly stricter, but if the first production deploy fails on TLS, this is the first thing to check.

---

## Verification that should follow the deploy

Match the standard the rest of the project has held to — check against the running system, not the code:

- Post a listing with a photo end-to-end in production (this is what proves the R2 CORS fix).
- Confirm all five security headers are present on a production response.
- Confirm `/api/upload` and `/api/ably/token` return 401 unauthenticated in production.
- Confirm rate limiting works against the production database.
- **The still-open item from Weeks 5-6:** two browser sessions, two GMI accounts, messages both ways with no refresh. Never yet observed. Doing it in production would close it and exercise the deployment simultaneously.

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
