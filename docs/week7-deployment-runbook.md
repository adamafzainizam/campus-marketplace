# Week 7 deployment runbook

**Companion to `week7-deployment-brief.md`.** The brief framed the decisions; this is the ordered procedure that follows from them.

The four decisions were resolved on 2026-08-14:

| Decision | Resolution |
|---|---|
| Domain | Ship on `.vercel.app`. Keep `r2.dev` for images, and record the rate-limiting caveat in the case study. |
| Production database | A separate Neon branch. |
| R2 bucket | Reuse `campus-marketplace-images-dev`. |
| Orphan cleanup (S2) | Do it now — **done**, see below. |

---

## Already done in code (branch `feature/deployment`)

Both are committed and verified locally; neither needs dashboard work.

- **Orphan cleanup shipped.** `/api/cron/cleanup-orphans` plus a daily schedule in `vercel.json`. Closes audit finding S2. 17 new tests (86 total, all passing), five security controls mutation-tested, and the whole thing exercised against the live bucket — including the delete path.
- **`prisma generate` added to the build script.** `src/generated/prisma` is gitignored with nothing tracked, so a fresh clone has no Prisma client. Verified by moving the directory aside: `next build` fails with module-not-found traced through `db.ts` into every page. **This would have been the first Vercel deploy failure**, and it was not in the brief's list of six.

---

## The ordering problem

The production URL does not exist until the first deploy, but three things need it: `NEXTAUTH_URL`, the Google OAuth callback, and the R2 CORS policy. So the first deploy is expected to be **partially broken** — that is normal, not a failure. Sign-in and uploads start working after step 5.

---

## Step 1 — Neon production branch

Create a branch off the current database in the Neon console.

A Neon branch is a copy-on-write clone: **it inherits the parent's data**, which here means 2 test listings and 1 real user. Production should start clean, so either create the branch schema-only if the console offers that option, or create it normally and then clear the rows.

Either way, confirm afterwards that the schema is present and the categories are seeded — the listing form renders with an empty category dropdown otherwise:

```bash
DATABASE_URL="<prod-branch-pooled-url>" npx prisma migrate deploy
DATABASE_URL="<prod-branch-pooled-url>" npx prisma db seed
```

Use the **pooled** connection string, matching what local dev uses.

## Step 2 — Generate the secrets

```bash
openssl rand -base64 32   # NEXTAUTH_SECRET (a fresh one for production)
openssl rand -base64 32   # NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
openssl rand -base64 32   # CRON_SECRET
```

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` must be base64 with a valid AES key length (16, 24, or 32 bytes) — `openssl rand -base64 32` gives 32. Next's self-hosting guide requires it to be stable across instances, or a server action encrypted by one instance can't be decrypted by another and you get "Failed to find Server Action" errors.

## Step 3 — Create the Vercel project

Import `adamafzainizam/campus-marketplace` from GitHub. Framework preset: Next.js. Leave the build command alone — `package.json` now handles `prisma generate`.

Set every one of these environment variables before deploying:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **production branch** pooled string |
| `GOOGLE_CLIENT_ID` | same as local |
| `GOOGLE_CLIENT_SECRET` | same as local |
| `NEXTAUTH_SECRET` | new value from step 2 |
| `NEXTAUTH_URL` | placeholder for now; fixed in step 5 |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | new value from step 2 |
| `CRON_SECRET` | new value from step 2 |
| `R2_ACCOUNT_ID` | same as local |
| `R2_ACCESS_KEY_ID` | same as local |
| `R2_SECRET_ACCESS_KEY` | same as local |
| `R2_BUCKET_NAME` | `campus-marketplace-images-dev` |
| `R2_PUBLIC_URL` | `https://pub-c0990a88042a463b99371ed032ec3b90.r2.dev` |

`R2_PUBLIC_URL` is read at **build** time as well as runtime — `next.config.ts` builds the CSP `img-src` from it. If it's missing at build, the CSP silently blocks every listing image. Set it before the first build, not after.

## Step 4 — Deploy, and note the URL

Deploy. Expect sign-in to fail at this point; that's step 5's job. The build itself should succeed.

## Step 5 — Wire the production URL into the three places that need it

1. **Vercel** → set `NEXTAUTH_URL` to `https://<project>.vercel.app` and redeploy.
2. **Google Cloud console** → OAuth client → Authorized redirect URIs → add `https://<project>.vercel.app/api/auth/callback/google`. Keep the localhost one so local dev keeps working.
3. **Cloudflare R2** → bucket → Settings → CORS Policy → add the production origin alongside `http://localhost:3000`:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://<project>.vercel.app"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"]
  }
]
```

This one **must be done in the dashboard** — the scoped Object Read & Write token returns `AccessDenied` on `PutBucketCors`, because CORS is a bucket-admin operation (Known Gotchas #14). R2 also rejects a wildcard `"*"` in `AllowedHeaders`, unlike S3.

Miss this and uploads fail in production with a bare `TypeError: Failed to fetch` and nothing in the server logs. Known Gotchas #18 has the triage ladder if it happens anyway.

## Step 6 — Confirm the cron wiring

`vercel.json` schedules `/api/cron/cleanup-orphans` daily at 03:00 UTC. Two things to check in the Vercel dashboard rather than assume:

- Cron jobs appear under the project's Cron Jobs tab, and **only run on production deployments**.
- Confirm against Vercel's current docs that setting `CRON_SECRET` is what makes Vercel send `Authorization: Bearer $CRON_SECRET`. That is what the route expects. If Vercel's mechanism differs, the route's auth check is the one line to adjust — the rules module is independent of it.

On the free tier the daily run may fire within a window rather than exactly on the hour. That's fine for this job.

---

## Verify after deploying

Run these against the live site. **Retry once before debugging anything** — Neon cold starts (Gotcha #16) and transient upload failures (Gotcha #18) both look exactly like real bugs.

- [ ] Sign in with a real GMI account
- [ ] Confirm a non-GMI Google account is rejected
- [ ] Post a listing **with a photo** — this is the check that catches a CORS mistake
- [ ] Confirm the image loads on both the browse grid and the detail page
- [ ] Open a conversation and send a message
- [ ] All five security headers present on a production response
- [ ] `/api/ably/token` returns 401 when signed out
- [ ] `/api/cron/cleanup-orphans` returns 401 without the secret
- [ ] Server actions work across instances (post two listings a few minutes apart — a `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` problem shows up as "Failed to find Server Action")

Once the URL exists, most of the above can be checked from here with `curl`.

---

## The two-session real-time test

This is the last gap between "built and tested" and "seen working", carried over from Weeks 5-6. Messaging was only ever exercised in a single browser: the Ably transport was verified independently against the live service, and the app wiring was verified in the browser, but nobody has watched those two halves meet.

**Do it after deployment, against the live URL, with a second person on their own device.** It cannot easily be done locally: the dev server is reachable on the LAN, but the Google OAuth client only has `http://localhost:3000` registered as a callback, so a second person pointing at `http://<lan-ip>:3000` cannot sign in at all. Deployment removes that obstacle rather than adding one.

The helper needs their own `@gmi.edu.my` or `@student.gmi.edu.my` account — the domain restriction in the `signIn` callback rejects everything else, which is itself worth watching them hit.

Procedure, with both people on the live site at the same time:

1. You post a listing. They open it and click **Message seller**.
2. **Both keep the thread open, and nobody refreshes for the rest of the test.** A refresh invalidates the result — the whole point is that the message arrives over the websocket, not on page load.
3. They send a message. It must appear on your screen without you touching anything.
4. You reply. Same thing in reverse.
5. Check presence flips to "is in this chat" on both sides, and that it clears when one person closes the tab.
6. Have them close the thread, then send them another message, and confirm the unread badge appears on their inbox.

What a failure looks like, and what it would mean:

- **Message never arrives, but is there after a refresh** — the Postgres write succeeded and the Ably publish or subscribe didn't. Check whether `/api/ably/token` is returning a token at all; a missing or wrong `ABLY_API_KEY` in the Vercel environment is the most likely production-only cause. Note that CSP is *not* a likely culprit: `next.config.ts` already allows `https://*.ably.io`, `wss://*.ably.io`, `https://*.ably-realtime.com` and `wss://*.ably-realtime.com` in production, not just in dev. A `connect-src` violation in the console would mean the policy changed, not that it was never configured.
- **Message never arrives even after a refresh** — the server action failed; not a real-time problem at all.
- **A `40160` error in the console** — a client attempted to publish. That should be impossible by design, since tokens carry `subscribe` and `presence` only; if it appears, something is publishing from the client that shouldn't be.

Record the result in `AGENTS.md` either way. A negative result is worth as much as a positive one here.

---

## Still open, carried forward

- Seller controls (edit, mark sold) — the most visible functional gap.
- Pagination beyond `take: 60`.
- `src/lib/conversations.ts` has no automated test; it is the authorization layer.
