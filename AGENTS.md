<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# AI Agent Bridge Document — Campus Marketplace

**This file is the shared memory between every AI agent working on this project** (Claude Code, Antigravity CLI, and any future tool that reads `AGENTS.md`). It exists because this project has been built collaboratively across multiple AI sessions and tools, and losing context between sessions has already caused real, time-costing mistakes (see "Known Gotchas" below).

## Standing instructions for any AI reading this

1. **Read this entire file before taking any action** in this repository, at the start of every session.
2. **Before ending your session** (or after any batch of meaningful changes — new dependencies, schema changes, new features, resolved bugs), **update this file**:
   - Update "Current State" to reflect reality.
   - Add a dated entry to "Decision Log" for any non-trivial choice made (library picked, pattern chosen, tradeoff accepted) — one or two lines with the *why*, not just the *what*.
   - Add to "Known Gotchas" if you hit something version-specific, confusing, or non-obvious that cost real time to figure out.
   - Update "Next Steps" to reflect what's actually left.
3. **Don't delete history** — append to the Decision Log and Known Gotchas rather than overwriting past entries, unless something is genuinely obsolete (and if so, say so explicitly rather than silently removing it).
4. **Verify before assuming.** This project has repeatedly hit version-specific surprises (Prisma 7, Auth.js v5) where training data / general knowledge was outdated. Check official docs for anything version-sensitive before proceeding on assumption.

---

## Project Overview

**What this is:** A marketplace/rental board for GMI (German-Malaysian Institute) students *and staff* to buy, sell, or rent secondhand items (textbooks, calculators, mini-fridges, etc.) to each other.

**Why it exists:** Portfolio project #1 of a 6-month full-stack build plan for a Diploma in Software Engineering student job-hunting afterward. Deliberately built as a real, demonstrable project — not a tutorial clone — covering auth, a real data model, image handling, and real-time messaging, plus professional habits (docs, tests, proper version control).

**Builder context:** ~10-15 hrs/week. Builder wants the reasoning behind every decision explained, not just instructions — this preference extends to AI agents working on the codebase: don't just make changes, record *why*. **Builder wants to complete this entire project without spending any money** — this is a standing constraint on every tool/service/infra choice, not just the ones already decided; default to free options and ask before introducing a paid one (see Decision Log 2026-08-11).

**8-week build plan:**
- Weeks 1-2: Foundation — auth + data model DONE (tagged `v0.1`)
- Weeks 3-4: Listings CRUD + image upload — CURRENT PHASE
- Weeks 5-6: Real-time messaging (buyer-seller, via Pusher/Ably)
- Week 7: Deployment (Vercel) + polish
- Week 8: Documentation + case study

**Git workflow (explicit learning goal, not incidental):** one feature = one branch (`feature/auth`, `feature/listing-crud`, etc.), atomic commits with meaningful messages, PR per feature branch before merging to `main` even though solo, tag a release (`v0.1`, `v0.2`...) at the end of each major milestone.

---

## Repository

- **Remote:** `git@github.com:adamafzainizam/campus-marketplace.git`
- **Local path:** `/home/adom/Documents/campus-marketplace`
- **Branch:** `main`
- **Git identity for this repo:** `adamafzainizam` / `m.adamafzainizam@gmail.com` — local override, deliberately separate from another GitHub account (`skibidam`) tied to the builder's GMI/school email that also exists on this machine. Never assume the global git config is correct for this repo; it's set locally on purpose.
- **Latest tag:** `v0.1` — "Foundation: Next.js scaffold, Prisma schema, Neon DB, Google OAuth with GMI domain restriction"

---

## Tech Stack (as implemented, with reasoning)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Tailwind, ESLint, `src/` dir, `@/*` alias) | Frontend + API routes together; App Router is current/actively developed |
| Database | Neon (serverless Postgres, Singapore AWS region) | Branching mirrors the git workflow; no credit card required; closest region to Malaysia |
| ORM | Prisma 7.9.1 | Type-safe queries — but see "Known Gotchas," this version differs structurally from most training data/tutorials |
| Auth | Auth.js v5 (`next-auth@beta`) + `@auth/prisma-adapter` | Complete rewrite from NextAuth v4 — see "Known Gotchas" |
| Auth provider | Google OAuth, restricted to `@gmi.edu.my` and all subdomains | GMI confirmed Google Workspace-backed; restriction enforced in the `signIn` callback, before any DB row is created, so rejected sign-ins need no cleanup |
| File storage | Cloudflare R2, served via the free Public Development URL (`r2.dev`) | S3-compatible, zero egress fees; chosen over Backblaze B2 (no APAC region — real latency cost for Malaysia-based users) and Supabase Storage (inconsistent with using Neon standalone rather than the Supabase platform). Public Development URL over a custom domain because the builder wants to build this project without spending money — see Known Gotchas and Decision Log |

---

## Current State (as of 2026-08-11)

**Done and verified:**
- Next.js scaffold, TypeScript/Tailwind/ESLint/App Router/`src/` dir
- Neon Postgres connected via pooled connection string
- Prisma schema migrated: `User`, `Category`, `Listing` (core), `Account`, `Session`, `VerificationToken` (Auth.js-required)
- Prisma client (`src/lib/db.ts`) using `@prisma/adapter-pg`, with dev-mode `globalThis` singleton caching
- Auth.js v5 fully wired (`src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`), Google OAuth, domain-restricted `signIn` callback, JWT session strategy
- End-to-end tested: real GMI Google account signed in successfully; `User` and `Account` rows confirmed created correctly via Prisma Studio
- All of the above committed, pushed, and tagged as `v0.1`
- Cloudflare R2 bucket created (`campus-marketplace-images-dev`) + scoped API token (Object Read & Write, restricted to this bucket); credentials added to `.env`
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` installed; R2 client at `src/lib/r2.ts`
- Presigned-upload API route (`src/app/api/upload/route.ts`): requires an authenticated session, allowlists `image/jpeg|png|webp`, caps size at 5MB, keys objects as `listings/<userId>/<uuid>.<ext>`, returns a 60s-expiring presigned PUT URL. Verified against a running dev server — correctly returns 401 when unauthenticated.
- `src/auth.ts` session callback added to expose `session.user.id` (needed to scope upload keys per user; not present by default under the JWT strategy), with matching module augmentation at `src/types/next-auth.d.ts`
- `prisma/seed.ts` seeds 7 standard categories (Textbooks, Electronics, Furniture, Appliances, Clothing, Sports & Outdoors, Other), wired via `migrations.seed` in `prisma.config.ts`; run with `npx prisma db seed`. Idempotent (`upsert` on `slug`).
- Listing creation flow built end-to-end: `src/app/listings/new/page.tsx` (server component, redirects unauthenticated visitors to `/api/auth/signin`, fetches categories), `ListingForm.tsx` (client component — file picker with local preview, calls `/api/upload` then `PUT`s the file straight to the presigned R2 URL, then calls the server action), `actions.ts` (`createListing` server action — validates title/description/price/condition/category server-side, writes the `Listing` row with `imageUrl` set to the raw R2 object key, not a working URL yet — see Decision Log 2026-08-11 on the `r2.dev`/custom-domain deferral)
- Verified via automated checks: `tsc --noEmit` clean, `eslint` clean, dev server boots with no errors, unauthenticated `GET /listings/new` correctly redirects to the Google sign-in page.
- **Authenticated golden path fully verified end-to-end by the builder (2026-08-11):** signed in with a real `@student.gmi.edu.my` account, posted a listing with an image through `/listings/new`, confirmed via direct DB + R2 query that the `Listing` row (correct seller/category/price/condition) and the R2 object (correct content-type, correct size) both exist. Required an R2 bucket CORS policy fix along the way — see Known Gotchas #14.
- R2 bucket's **Public Development URL** (Cloudflare's current name for the `r2.dev` dev subdomain) enabled: `https://pub-c0990a88042a463b99371ed032ec3b90.r2.dev`, stored as `R2_PUBLIC_URL` in `.env`. Chosen over a custom domain specifically because the builder wants to build this whole project without spending money, and a custom domain would require buying one (see the no-spend-constraint memory / Decision Log 2026-08-11).
- `getImageUrl(key)` helper added to `src/lib/r2.ts`, converting a stored object key into a displayable URL via `R2_PUBLIC_URL`.
- Listing browse page (`src/app/page.tsx`, replacing the default create-next-app scaffold) and listing detail page (`src/app/listings/[id]/page.tsx`) built: grid of `AVAILABLE` listings with image/title/price, category-pill filtering, a text search box (`title` substring match, case-insensitive), and a "Listing posted successfully" banner after the `?created=` redirect from `createListing`. `CONDITION_LABELS` extracted to `src/lib/listing-labels.ts` so both the form and detail page share it.
- Verified in a real browser end-to-end by the builder, plus automated `curl` checks confirming: search and category filters both narrow results and both empty-correctly on no match, the detail page 404s on an unknown id, and the public R2 image URL is actually fetchable (200, `image/jpeg`) — not just constructed correctly.
- **Upload validation hardened (2026-08-12, branch `fix/upload-validation`)**, after a review pass found two real holes in the code merged in PR #1: the content-type allowlist was bypassable via the prototype chain (Known Gotchas #15) and the client-supplied `imageKey` was stored unvalidated (#17). Both fixed, plus a malformed-JSON guard on `/api/upload` and proper error handling/exit code in `prisma/seed.ts`. Upload rules now live in one place, `src/lib/upload-constraints.ts`, shared by the route that mints keys and the action that has to trust them, so the two can't drift apart.
- **The "signed `ContentLength` caps upload size" claim is now empirically verified, not assumed** (it was previously only asserted in the Decision Log). Probed against the live bucket: `content-length` does appear in `X-Amz-SignedHeaders`, and R2 rejects a body larger than the signed size with `403 Forbidden` and stores nothing. The 5MB cap is genuinely enforced server-side — relevant to the no-spend constraint, since R2's free tier is 10GB.

**Decided but not started:**
- Cloudflare budget alert setup (no hard spending cap exists on R2 — alerts are the only safety net)

**Not yet decided:**
- Pagination for the listing browse grid (not needed yet at current data volume, but will be before real users show up)
- Whether/how sellers can edit or mark their own listings as sold (no edit/delete UI built yet — `ListingStatus` exists in the schema but nothing sets it to `PENDING`/`SOLD`)

---

## Database Schema Notes

- IDs use `@default(cuid())`, not auto-increment or plain `uuid()` — URL-safe, doesn't leak row-count info.
- `Listing.price` is `Decimal(10,2)`, never `Float` — floating point can't represent money exactly.
- `ListingCondition` and `ListingStatus` are enums, not free-text strings — enforced at the DB level to prevent typo bugs (e.g. status checks silently failing).
- `Listing`'s relations use `onDelete: Restrict` (default) — deliberately blocks deleting a `User`/`Category` that still has listings, forcing an explicit decision rather than silent cascade.
- `Account`/`Session` use `onDelete: Cascade` from `User` — they're meaningless without their user, so cascading is correct there.
- Auth.js adapter models (`Account`, `Session`, `VerificationToken`) use exact field names required by `@auth/prisma-adapter` — do not rename fields like `sessionToken` or `providerAccountId`, the adapter queries by these exact names.

---

## Environment Variables (`.env`, gitignored — names only, no values here)

```
DATABASE_URL          # Neon pooled connection string
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET       # openssl rand -base64 32
NEXTAUTH_URL          # http://localhost:3000 for local dev
```

Added and populated:
```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME         # "campus-marketplace-images-dev"
R2_PUBLIC_URL          # "https://pub-c0990a88042a463b99371ed032ec3b90.r2.dev" — bucket's Public Development URL
```

---

## Known Gotchas (version-specific traps already hit — don't rediscover these)

1. **Prisma 7 moved the connection string out of `schema.prisma` into `prisma.config.ts`.** The runtime `PrismaClient` does NOT read `DATABASE_URL` automatically — it requires an explicit driver adapter (`@prisma/adapter-pg`) constructed with the connection string passed directly. Standalone scripts (outside Next.js's own dev server) also need `import "dotenv/config"` explicitly, or `DATABASE_URL` will be `undefined` and Postgres silently falls back to `localhost:5432`.
2. **`prisma migrate dev` can apply a migration without the generated client actually including the new models.** After any migration, verify `src/generated/prisma/models.ts` lists every expected model. If not, run `npx prisma generate` explicitly and clear `.next/` before restarting the dev server.
3. **Auth.js v5 (`next-auth@beta`) is a full rewrite from v4** — config lives in `src/auth.ts` (not `pages/api/auth/[...nextauth].js`), env var naming conventions changed (`AUTH_*` prefix is the new default, though this project explicitly passes `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`NEXTAUTH_SECRET` values rather than relying on auto-detection, so the old names still work here).
4. **Domain-restriction logic must use `.endsWith(".gmi.edu.my")` OR exact match, never `===` alone** — GMI accounts are `@student.gmi.edu.my`, a subdomain, not the bare `@gmi.edu.my`. Also never use `.includes()` for this check — it would match spoofed domains like `notgmi.edu.my.attacker.com`.
5. **SSH: the working key is `~/.ssh/id_ed25519_new` (no passphrase), loaded via `ssh-agent`.** The original `~/.ssh/id_ed25519` has a real, unknown passphrase (despite being intended as blank) and is non-functional — don't try to use it. After every fresh terminal session/reboot, run `eval "$(ssh-agent -s)"` then `ssh-add ~/.ssh/id_ed25519_new`, or git push/pull will hang on a passphrase prompt.
6. **Two GitHub accounts exist on this machine**: `adamafzainizam` (this project) and `skibidam` (GMI-linked). SSH keys can only belong to one GitHub account at a time — if a "key already in use" error appears, check which account is logged into the browser before adding a key.
7. **`npm audit` reports 3 pre-existing high-severity issues** in the `postcss`/`sharp`/`next` dependency chain. Deliberately not fixed — `npm audit fix --force` would downgrade Next.js by several major versions. Not currently exploitable (no untrusted CSS input; no unvalidated image processing yet). Revisit before production deployment, not before.
8. **Cloudflare has no hard spending cap** on R2 — only threshold-based email alerts. Don't assume a "safety net" exists beyond that.
9. **Auth.js v5's JWT session strategy does not include `session.user.id` by default** — only `name`/`email`/`image` are populated. Any code that needs the user's DB id off the session (e.g. scoping uploaded object keys per user) requires an explicit `session` callback copying `token.sub` into `session.user.id`, plus a `declare module "next-auth"` type augmentation (see `src/types/next-auth.d.ts`) or it won't type-check.
10. **Correction to gotcha #7:** `npm audit` now also flags `nanoid` (via the `postcss` chain, pulled in transitively by both `next` and `@tailwindcss/postcss`) as a 4th pre-existing high-severity issue, not 3. It predates the R2/AWS SDK install (confirmed via `git diff` on `package-lock.json` showing no changes to the existing `nanoid` entry) — the AWS SDK packages did not introduce it. Same reasoning as #7 still applies: not currently exploitable, revisit before production deployment.
11. **This project enforces npm's `allowScripts` allowlist** (see `package.json`) — installing a new package whose dependency tree includes a lifecycle (`postinstall`) script will silently skip that script and print an `npm warn allow-scripts` line rather than failing loudly. Run `npm approve-scripts <pkg>` to review and approve after checking the package is reputable (this project already scoped-approved `sharp`, `unrs-resolver`, `prisma`, `@prisma/engines`, and `esbuild` — the last needed by `tsx`, which the seed script depends on).
12. **Process reminder, not a code gotcha:** the R2/upload work in this session (session callback, upload route, R2 client) was initially built directly on `main`, in violation of this file's own "one feature = one branch" standing instruction. Caught and fixed by branching to `feature/listing-crud` mid-session and carrying the uncommitted work over — but any AI agent picking up a task here should create the feature branch *first*, before writing any code, not after.
13. **`redirect()` from `next/navigation`, when called inside a server action that a client component invokes directly (not via `<form action={...}>`), throws a control-flow error that a client-side `try/catch` around the call will silently swallow unless you rethrow it.** Use `unstable_rethrow(err)` (exported from `next/navigation` in this version) as the first line of the `catch` block — it rethrows Next.js's internal redirect/notFound/etc. errors and no-ops for anything else. Missing this makes the redirect silently fail and shows a generic error message instead of navigating. See `src/app/listings/new/ListingForm.tsx`.
14. **R2 buckets have no CORS policy by default, which blocks browser-side presigned uploads.** A direct `PUT` from client-side JS to a presigned R2 URL fails as a generic, undebuggable `TypeError: Failed to fetch` (CORS preflight blocks it before any HTTP response exists to inspect) — the `POST /api/upload` call that generates the presigned URL succeeds fine, only the follow-up browser `PUT` to R2 itself fails, which is confusing because nothing shows up server-side. Fix: bucket → **Settings → CORS Policy** in the dashboard, allowing the app's origin, `PUT`/`GET`/`HEAD`, and `AllowedHeaders: ["content-type"]` (R2 does not support a wildcard `"*"` in `AllowedHeaders` the way AWS S3 does). **This cannot be set via the scoped Object-Read-&-Write API token** — `PutBucketCorsCommand` returns `AccessDenied` — because CORS is a bucket-admin operation, not a data-plane one; it has to go through the dashboard (or a token with Admin Read & Write scope). Current policy only allows `http://localhost:3000` — add the production origin here once deployed (Week 7), or uploads will break there too.
15. **A plain-object allowlist (`const ALLOWED = {...}; if (ALLOWED[userInput])`) is bypassable via the prototype chain.** Inherited keys — `constructor`, `toString`, `valueOf`, `hasOwnProperty` — all resolve to truthy functions off `Object.prototype`, so they sail through a bare truthiness check. This was a real bug in `/api/upload`'s content-type allowlist: `{"contentType":"constructor"}` passed validation, defeating the image-type restriction entirely. Fixed by guarding with `Object.hasOwn()` plus an explicit `typeof === "string"` check (see `src/lib/upload-constraints.ts`). Applies to any allowlist keyed by user input, not just this one.
16. **Neon auto-suspends idle serverless databases, and the first query after a cold start can fail with `ETIMEDOUT`** — surfacing as a confusing HTTP 500 on any DB-backed page (or a failed `prisma db seed`) that looks exactly like an app bug. It clears on retry within a few seconds. Before debugging a 500 on a page that worked before, retry once and check the dev-server log for `PrismaClientKnownRequestError ... code: 'ETIMEDOUT'` — that's the database waking up, not your code.
17. **Anything the browser hands back after an out-of-band upload is still user input.** `/api/upload` carefully scopes each object key to the uploader (`listings/<userId>/<uuid>.<ext>`), but the browser uploads directly to R2 and then reports the key to the `createListing` server action — so the server never observes the upload itself. Without re-validating that the key matches the *session user's* expected pattern, a user could attach an arbitrary path, including another user's image. See `isValidListingImageKey` in `src/lib/upload-constraints.ts`.

---

## Decision Log

- **2026-08-03** — Chose Neon over Supabase for the database: no credit card required, branching model mirrors the git workflow, avoids adopting Supabase's bundled platform features when the project deliberately uses separate best-of-breed tools elsewhere (Auth.js, not Supabase Auth).
- **2026-08-03** — Chose Auth.js v5 + Google OAuth over credential-based auth: identity verification comes free from Google, and it naturally enforces "GMI community only" without hand-rolled password security.
- **2026-08-09** — Domain restriction broadened from `@student.gmi.edu.my` only to all of `@gmi.edu.my` (including subdomains), at the builder's request, so GMI staff (not just students) can use the marketplace too.
- **2026-08-10** — Chose Cloudflare R2 over Backblaze B2 for image storage, despite B2 requiring no credit card: R2's lack of a hard APAC region gap matters more than the card friction, given the app's real users are in Malaysia. UploadThing was also considered and passed on in favor of R2's more transferable, general S3-API knowledge for job-hunting purposes.
- **2026-08-11** — Used presigned PUT (`@aws-sdk/s3-request-presigner` + `PutObjectCommand`) rather than presigned POST for uploads: simpler client flow (one `PUT` request), and the app already knows the exact file size client-side before upload, so signing `ContentLength` gives an effective size cap without needing POST's condition-policy machinery (which would've required the separate `@aws-sdk/s3-presigned-post` package).
- **2026-08-11** — Deliberately deferred the choice between `r2.dev` public dev subdomain vs. a Cloudflare-managed custom domain for serving bucket images. Cloudflare explicitly documents `r2.dev` as a debug-only hostname (rate-limited, uncached, not meant for production), so it's not a long-term answer — but a custom domain requires a domain already onboarded as a Cloudflare DNS zone, which this project doesn't have yet. Decided to use `r2.dev` when image display is actually built (not yet), and switch to a custom domain at Week 7 deployment when a real domain is set up anyway, rather than blocking listings CRUD work on a domain decision today.
- **2026-08-11** — Because the serving-domain decision above is still open, `Listing.imageUrl` is populated with the raw R2 object key (e.g. `listings/<userId>/<uuid>.jpg`) rather than a full URL, at listing-creation time. This keeps the create flow working without forcing the domain decision early; it does mean a small conversion helper (key → displayable URL) will be needed once the listing detail/browse pages are built and the domain choice is made.
- **2026-08-11** — Seeded a fixed set of 7 categories (Textbooks, Electronics, Furniture, Appliances, Clothing, Sports & Outdoors, Other) via `prisma/seed.ts` rather than building category-management UI: matches the item types already named in this file's Project Overview, and category management isn't part of the 8-week build plan — categories are expected to be a fixed, curated list, not user-generated.
- **2026-08-12** — Centralised all image-upload rules (allowed types, max size, key format, key-ownership check) in `src/lib/upload-constraints.ts` rather than leaving them inline in `/api/upload`. The route mints object keys and the `createListing` server action has to validate keys the browser hands back; those two rules must agree exactly, and duplicating the format in two files is how they silently drift. Also chose `Object.hasOwn()` over a bare property lookup for the allowlist after confirming the prototype-chain bypass was live (Known Gotchas #15).
- **2026-08-11** — Resolved the `r2.dev` vs. custom-domain deferral from earlier the same day: **the builder wants to complete this entire project without spending any money**, and a custom domain would require actually buying one (R2 → custom domain itself is free, but domain registration isn't). Enabled R2's Public Development URL instead — free, immediate, no purchase required. This is a standing constraint, not just a one-off call: any future choice between a free and a paid option on this project should default to free unless there's genuinely no free way to do it, in which case ask before spending anything.

---

## Next Steps

1. ~~Create Cloudflare R2 bucket + scoped API token~~ — done 2026-08-11.
2. ~~Add R2 credentials to `.env`~~ — done 2026-08-11.
3. Set a Cloudflare budget alert as a safety net (no hard cap exists) — still outstanding.
4. ~~Install `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, write a presigned-URL upload API route~~ — done 2026-08-11 (`src/app/api/upload/route.ts`).
5. ~~Build the client-side upload flow and listing creation form~~ — done 2026-08-11 (`src/app/listings/new/`: `page.tsx`, `ListingForm.tsx`, `actions.ts`), **and verified end-to-end by the builder** with a real GMI account and a real image upload.
6. ~~Configure R2 bucket CORS policy~~ — done 2026-08-11, via dashboard (see Known Gotchas #14). Currently scoped to `http://localhost:3000` only — must add the production origin before Week 7 deployment.
7. ~~Decide `r2.dev` vs. custom domain for serving images~~ — done 2026-08-11, `r2.dev` (see Decision Log).
8. ~~Build listing detail page, category browsing, basic search/filter~~ — done 2026-08-11 (`src/app/page.tsx`, `src/app/listings/[id]/page.tsx`), verified in-browser and via automated checks.
9. Remaining before tagging `v0.2`: the Cloudflare budget alert (item 3, still outstanding) — everything else in the Weeks 3-4 plan (listings CRUD + image upload) is done. Consider whether pagination or seller edit/mark-as-sold controls are needed before tagging, or whether those can be deferred to Weeks 5-6 alongside messaging.
10. Tag `v0.2` once the above is settled.
