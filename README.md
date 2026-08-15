# Campus Marketplace

A buy/sell/rent board for GMI (German-Malaysian Institute) students and staff, so people on campus can pass on secondhand textbooks, calculators, mini-fridges and the like instead of throwing them out.

Sign-in is restricted to GMI Google accounts, so everyone you're dealing with is actually part of the campus community.

**Live: [campus-marketplace-adamafzainizam.vercel.app](https://campus-marketplace-adamafzainizam.vercel.app)** — anyone can browse without an account.

**📝 [Read the case study](./docs/case-study.md)** — the architecture decisions, the four bugs that only appeared in production, and the one thing I'd do differently.

> **Status:** deployed and working. All eight weeks of feature work are done.

---

## Why this exists

This is a portfolio project, built to job-hunt with after a Diploma in Software Engineering. The goal was to build something real rather than follow a tutorial — meaning a genuine data model, real authentication, real file handling, and the habits that go with working on a team (feature branches, pull requests, written-down decisions).

It's also built under one hard constraint: **no money spent, anywhere.** Every service in the stack is on a free tier, and that constraint drove several of the technical choices below.

---

## What works so far

- [x] Sign in with Google, restricted to `@gmi.edu.my` addresses and subdomains (e.g. `@student.gmi.edu.my`)
- [x] Post a listing — title, description, price, condition, category, and a photo
- [x] Photo upload straight from the browser to cloud storage
- [x] Browse all available listings
- [x] Filter listings by category
- [x] Search listings by title
- [x] View a single listing in detail
- [x] Live upload progress while a photo is sending
- [x] Rent as well as sell — prices read as "RM 20 / week", not just a bare number
- [x] Real-time messaging between buyer and seller, with unread badges and presence
- [x] Manage your own listings — edit anything, mark reserved, sold, or archived
- [x] Deployed and publicly reachable
- [x] Works on a phone as well as a desktop, in light and dark

- [x] Report a listing or a message, with a moderation queue behind it
- [x] Moderation — suspend an account, take a listing down, with every action recorded in an audit log

Known gaps, deliberately: no pagination yet (the grid is capped at 60), and no way to block another user — reporting exists, blocking doesn't.

---

## Tech stack

| What | Choice | Why this one |
|---|---|---|
| Framework | Next.js 16 (App Router) | Frontend and backend in one project, so there's no separate API server to run or deploy |
| Language | TypeScript | Catches a whole class of mistakes before the code ever runs |
| Styling | Tailwind CSS | Styling stays in the markup; no separate stylesheet to keep in sync |
| Database | Neon (hosted Postgres) | Free tier with no credit card, and the Singapore region is the closest to Malaysia |
| Database access | Prisma 7 | Queries are type-checked against the actual schema |
| Authentication | Auth.js v5 | Google handles identity, so no passwords are ever stored |
| Image storage | Cloudflare R2 | S3-compatible and charges nothing for bandwidth, which matters when a page is mostly photos |
| Real-time | Ably | Managed WebSockets. Buying this rather than self-hosting Socket.io was deliberate — see the case study |
| Hosting | Vercel | Free tier, deploys on push to `main`, and runs the scheduled cleanup job |
| Tests | `node:test` | Node's built-in runner, so the test suite adds no dependencies at all |

---

## Running it locally

**You'll need:** Node.js 20 or newer, a Postgres database, a Google OAuth client, and a Cloudflare R2 bucket. All of these have free tiers.

**1. Install dependencies**

```bash
npm install
```

**2. Create a `.env` file** in the project root:

```bash
DATABASE_URL=          # Postgres connection string
GOOGLE_CLIENT_ID=      # from Google Cloud Console
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=       # generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

R2_ACCOUNT_ID=         # Cloudflare account ID
R2_ACCESS_KEY_ID=      # from an R2 API token
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=         # the bucket's Public Development URL

ABLY_API_KEY=          # server-only; never prefix this NEXT_PUBLIC_
CRON_SECRET=           # any random string; guards the cleanup job
```

This file is gitignored and should never be committed.

**3. Set up the database**

```bash
npx prisma generate      # build the typed database client
npx prisma migrate deploy # create the tables
npx prisma db seed        # add the category list
```

The generated client isn't checked into git, so `prisma generate` isn't optional — the app won't compile without it.

**4. Start it**

```bash
npm run dev
```

Then open http://localhost:3000.

**Running the tests**

```bash
npm test
```

253 tests, no test framework installed — it uses Node's built-in runner and its native TypeScript support.

### One thing that will trip you up

Cloudflare R2 buckets block browser uploads by default, and the failure looks like a generic "Failed to fetch" in the console with nothing useful on the server side. In the bucket's **Settings → CORS Policy**, add:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

R2 rejects a wildcard `"*"` in `AllowedHeaders`, unlike AWS S3.

---

## How image upload works

Photos never pass through the app's own server. Instead:

1. The browser asks the server for permission to upload a specific file.
2. The server checks you're signed in, checks the file is a JPEG/PNG/WebP under 5MB, and hands back a short-lived upload link tied to that exact file size.
3. The browser uploads the photo directly to Cloudflare.
4. The browser tells the server where the photo landed, and the server saves the listing.

The upside is that large files never occupy the app server. The catch is that step 4 is just the browser making a claim, so the server re-checks that the reported location is one it actually issued to *that* user. The size limit is enforced by the storage provider itself — an upload larger than what was approved is rejected outright.

---

## Project layout

```
prisma/
  schema.prisma       database tables and relationships
  seed.ts             creates the fixed category list
src/
  app/
    page.tsx          home page: browse, search, filter
    signin/           sign-in, and why an account was rejected
    listings/new/     the "post a listing" form
    listings/[id]/    a single listing, and its edit page
    listings/mine/    manage your own listings
    messages/         inbox and conversation threads
    legal/            terms, privacy, acceptable use, disclaimer
    admin/            moderation: reports, people, and the audit log
    api/upload/       issues upload permissions
    api/ably/token/   issues capability-scoped realtime tokens
    api/cron/         nightly cleanup of unreferenced photos
  components/         header, breadcrumbs, loading skeletons
  lib/                database and storage clients, plus the shared rules —
                      every one of these is pure and has tests
  auth.ts             sign-in config and the GMI email restriction
```

---

## Roadmap

An 8-week plan, worked on roughly 10–15 hours a week.

| Weeks | Focus | Status |
|---|---|---|
| 1–2 | Sign-in and database design | Done — `v0.1` |
| 3–4 | Listings and image upload | Done — `v0.2` |
| 5–6 | Buyer–seller messaging | Done — `v0.3` |
| 7 | Deployment and polish | Done — `v0.4`, live |
| 8 | Documentation and write-up | Case study done; screenshots outstanding |

---

## A note on affiliation

**This is an independent student project. It is not affiliated with, endorsed by, or operated by the German-Malaysian Institute.** The name describes who the marketplace is for, not who runs it. Every page on the live site says so, and [`/legal/disclaimer`](https://campus-marketplace-adamafzainizam.vercel.app/legal/disclaimer) sets it out in full, along with a direct contact route for GMI should they have any concern.

The site publishes [terms](https://campus-marketplace-adamafzainizam.vercel.app/legal/terms), a [privacy policy](https://campus-marketplace-adamafzainizam.vercel.app/legal/privacy) written against Malaysia's PDPA 2010, and an [acceptable use policy](https://campus-marketplace-adamafzainizam.vercel.app/legal/acceptable-use) that prohibits, among other things, trading in exam materials or assignment-writing services.

---

## Licence

[MIT](./LICENSE) — read it, learn from it, reuse it, just keep the copyright notice.

---

## Other documentation

[`docs/case-study.md`](./docs/case-study.md) is the project write-up: why real-time messaging was bought rather than built, why the rate limiter lives in Postgres, the four bugs that could only appear in production, and the one part of the codebase I'd test properly given more time.

[`AGENTS.md`](./AGENTS.md) is a working log kept alongside the code — every non-obvious decision and the reasoning behind it, plus the version-specific traps that cost real time to figure out. It's written for the AI tools used to build this, but it doubles as the honest engineering history of the project.
