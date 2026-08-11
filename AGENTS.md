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

**Builder context:** ~10-15 hrs/week. Builder wants the reasoning behind every decision explained, not just instructions — this preference extends to AI agents working on the codebase: don't just make changes, record *why*.

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
| File storage | Cloudflare R2 (decided, not yet implemented) | S3-compatible, zero egress fees; chosen over Backblaze B2 (no APAC region — real latency cost for Malaysia-based users) and Supabase Storage (inconsistent with using Neon standalone rather than the Supabase platform) |

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

**Decided but not started:**
- Cloudflare budget alert setup (no hard spending cap exists on R2 — alerts are the only safety net)
- Making the R2 bucket's contents servable (public `r2.dev` dev subdomain vs. custom domain) — deliberately deferred, see Decision Log 2026-08-11

**Not yet decided:**
- Listing creation form / validation approach
- Search/filter implementation details
- Image upload UI/UX flow (client-side flow that calls `/api/upload` then `PUT`s directly to the presigned URL, not yet built)

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

---

## Decision Log

- **2026-08-03** — Chose Neon over Supabase for the database: no credit card required, branching model mirrors the git workflow, avoids adopting Supabase's bundled platform features when the project deliberately uses separate best-of-breed tools elsewhere (Auth.js, not Supabase Auth).
- **2026-08-03** — Chose Auth.js v5 + Google OAuth over credential-based auth: identity verification comes free from Google, and it naturally enforces "GMI community only" without hand-rolled password security.
- **2026-08-09** — Domain restriction broadened from `@student.gmi.edu.my` only to all of `@gmi.edu.my` (including subdomains), at the builder's request, so GMI staff (not just students) can use the marketplace too.
- **2026-08-10** — Chose Cloudflare R2 over Backblaze B2 for image storage, despite B2 requiring no credit card: R2's lack of a hard APAC region gap matters more than the card friction, given the app's real users are in Malaysia. UploadThing was also considered and passed on in favor of R2's more transferable, general S3-API knowledge for job-hunting purposes.
- **2026-08-11** — Used presigned PUT (`@aws-sdk/s3-request-presigner` + `PutObjectCommand`) rather than presigned POST for uploads: simpler client flow (one `PUT` request), and the app already knows the exact file size client-side before upload, so signing `ContentLength` gives an effective size cap without needing POST's condition-policy machinery (which would've required the separate `@aws-sdk/s3-presigned-post` package).
- **2026-08-11** — Deliberately deferred the choice between `r2.dev` public dev subdomain vs. a Cloudflare-managed custom domain for serving bucket images. Cloudflare explicitly documents `r2.dev` as a debug-only hostname (rate-limited, uncached, not meant for production), so it's not a long-term answer — but a custom domain requires a domain already onboarded as a Cloudflare DNS zone, which this project doesn't have yet. Decided to use `r2.dev` when image display is actually built (not yet), and switch to a custom domain at Week 7 deployment when a real domain is set up anyway, rather than blocking listings CRUD work on a domain decision today.

---

## Next Steps

1. ~~Create Cloudflare R2 bucket + scoped API token~~ — done 2026-08-11.
2. ~~Add R2 credentials to `.env`~~ — done 2026-08-11.
3. Set a Cloudflare budget alert as a safety net (no hard cap exists) — still outstanding.
4. ~~Install `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, write a presigned-URL upload API route~~ — done 2026-08-11 (`src/app/api/upload/route.ts`).
5. Decide `r2.dev` vs. custom domain for serving images (deferred — see Decision Log 2026-08-11), then build the client-side upload flow (select file → `POST /api/upload` → `PUT` to presigned URL → store returned key/URL).
6. Build listing creation form (title, description, price, condition, category, image), wired to the upload flow above and a `Listing` create mutation.
7. Build listing detail page, category browsing, basic search/filter.
8. Tag `v0.2` at the end of this phase.
