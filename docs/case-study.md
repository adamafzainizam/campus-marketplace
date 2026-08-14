# Campus Marketplace — a case study

**Live:** [campus-marketplace-adamafzainizam.vercel.app](https://campus-marketplace-adamafzainizam.vercel.app)
**Source:** this repository
**Built:** 8 weeks, solo, roughly 10–15 hours a week

This is the write-up of a portfolio project, aimed at whoever is deciding whether the code is worth a closer look. The README covers what the app does and how to run it, so neither is repeated here. This document is about how the decisions got made, which is the part a screenshot can't show.

---

## The problem

Every semester at GMI, people throw away things other people are about to buy. Textbooks for a module that just ended, a scientific calculator, a mini-fridge that won't fit in the car home. The trade already happens, but it happens in ad-hoc WhatsApp groups and on physical noticeboards, where nothing is searchable, nothing persists past the scroll, and you have no idea who is on the other end.

The searchability half is ordinary CRUD. The interesting half is trust. A marketplace between strangers usually answers that with ratings and review counts, which need volume to mean anything and are worth nothing on day one. This app can sidestep the problem entirely, because its users share something strangers on the open internet don't: an institution. Sign-in is restricted to `@gmi.edu.my` and its subdomains, checked in the auth callback before any database row is created. There is no rating system, because being verifiably on campus does more work than five stars from an account created yesterday.

Two constraints shaped everything that follows. The project had to cost **nothing** — every service in the stack is on a free tier, and that ruled out several otherwise better options. And it had to fit around a diploma, at 10–15 hours a week, which meant favouring decisions that stayed cheap to reverse.

---

## Four decisions worth explaining

Most technical choices in a project like this are not interesting. TypeScript because types catch mistakes; Tailwind because the styles stay next to the markup. These four had real tension in them.

### Buying real-time rather than building it

Messaging is the least tutorial-shaped part of the project, and the obvious move is to self-host Socket.io. I used Ably instead, a managed WebSocket service, specifically because arguing *why buy rather than build* is a more useful thing to be able to do than demonstrating that I can keep a socket server alive.

What made the decision genuinely interesting was reading the free tier properly. Ably gives 6 million messages a month and 200 concurrent connections, which is far more than this app will ever need. It also retains messages for **one day**. That single number settled the architecture: Ably can never be the store of record, so Postgres owns all message history and Ably does live fan-out only. That is the correct design regardless, but it arrived as a hard constraint rather than as good taste, which is a better reason to trust it.

### Clients are never given permission to publish

The messaging flow is server-authoritative: a client calls a server action, the server writes to Postgres, and only then publishes to Ably. The alternative — letting clients publish directly — creates two authorities that can disagree, where a client could put a message on a channel that never reaches the database.

The part I'd point at in an interview is what falls out of that. Because the server is the only publisher, client tokens are issued with `subscribe` and `presence` capabilities and nothing else, scoped to channels a database lookup has confirmed the caller belongs to. A stolen token cannot forge a message, and not because a check somewhere rejects it — because the ability isn't in the token. I verified this against the live service rather than assuming it: a client holding a real token that attempts to publish is refused by Ably itself with `40160: Unable to publish a message due to lacking the required 'publish' capability`, while a server publish on the same channel reaches that same client normally.

### Rate limiting in Postgres, not in memory

A security pass found that nothing in the app was rate limited anywhere. An authenticated user could mint unlimited upload URLs against a storage tier with a 10GB ceiling, on a provider with no hard spending cap — a straight path from an ordinary student account to a real bill, on a project whose defining constraint is not spending money.

The reflex fix is an in-memory `Map` of counters. It would have passed every test I could write for it, and it would have been close to worthless, because this deploys to Vercel, where consecutive requests may land on different serverless instances that cold-start freely. An in-memory counter hands an attacker a fresh budget per instance. **It is protection that convinces in development and evaporates in production**, which is a worse outcome than none, since you stop looking.

Redis would be the standard answer, and Upstash would have done it well, but it adds an account and a service that can bill. So the counter lives in Postgres, which the app already has, as a single `INSERT ... ON CONFLICT DO UPDATE` — one statement, because a read followed by a write is a race an attacker will win. Verified against the live database: it blocks on request 21 of a limit of 20, an expired window resets to 1 rather than locking someone out permanently, and 30 parallel requests produced 30 distinct counts with no lost updates.

### One storage bucket, then two — a decision that stopped being right

Deploying, I decided production would share the existing image bucket with local development. The reasoning was sound: a second bucket means a second CORS policy, and a misconfigured CORS policy on this stack fails as an undebuggable `TypeError: Failed to fetch` with nothing in the server logs. Less surface, less to get wrong.

It was wrong within hours, and not because the reasoning was bad. Earlier the same day I had built a nightly cleanup job that deletes any stored image no listing references — necessary, because the browser uploads to storage *before* the listing is submitted, so abandoning the form leaks a file forever. Production's database has never heard of anything created during local development. One shared bucket therefore meant production quietly deleting my development images about a day after I uploaded them, and I would have had almost no chance of guessing that from the symptom.

I've recorded it in the decision log as a reversal rather than editing the original away, because *why* it changed is the useful part: a correct decision became incorrect when a new component landed near it. Two buckets cost one extra CORS policy. One bucket cost an entire class of cross-environment data loss.

---

## What broke in production, and why it could only break there

The app worked in development for a month. Then it went live and four things were broken at once, none of which could have been caught locally. Three of them came from the same source.

A security pass had added response headers, including a Content-Security-Policy. Every CSP directive it set was correct in the sense of being deliberate. Three of them broke a user-facing path, and every one of those paths had last been exercised the day *before* the policy landed.

**Sign-in did nothing at all.** Not an error — nothing. The button was pressed and the page sat there. The cause was `form-action 'self'`. Browsers apply `form-action` to the *redirect target* of a form submission, not just to the URL in the `action` attribute, and the sign-in form posts to our own origin, which answers with a redirect to Google. The hop was blocked. Nothing appeared in the server logs, because the server had done its job perfectly and handed back a correct 302. I confirmed that by posting the form with `curl`, which succeeded, and that is what localised the fault to policy rather than configuration. It went unnoticed for a day for an unglamorous reason: I already had a session cookie, so no fresh sign-in ever ran in my browser.

**Photo upload failed with what looked like a network fault.** The message was "Could not reach image storage. Check your internet connection." The cause was `connect-src`, which listed the host that *serves* images but not the one the browser *uploads* to. Those are different hosts on this provider, and since every image on the site rendered fine, the policy looked correct.

This one is worth dwelling on because the obvious diagnostic actively lies. The failure looks exactly like a CORS problem, and the app has a documented history of CORS problems. But CORS is irrelevant here: the browser blocks the request before it leaves, so nothing ever reaches storage and no preflight is ever sent. A server-side preflight check passes happily while the browser continues to fail, which sends you into the wrong layer with apparent evidence that you're in the right one.

**Then the fix for that didn't work either.** I allowed the storage API host I had configured. The real request goes somewhere else: the AWS SDK addresses this provider **virtual-hosted style**, rewriting the endpoint so the bucket becomes a subdomain. CSP host matching is exact and a parent domain does not match its subdomains, so uploads stayed blocked while the policy looked fixed. The lesson was not to reason about the hostname. I generated a signed URL and printed `new URL(url).origin`, and there is now a test asserting the policy covers exactly that.

**And every validation message in the app was unreadable.** Next.js masks any error *thrown* out of a server action in a production build, replacing it with a generic notice and a digest. This is deliberate and documented, and it means "description must be at least 10 characters" and a genuine crash were indistinguishable to the user, who got a wall of text instead of the one sentence that would have fixed their problem. All 23 sites now return a result object instead of throwing; throwing is reserved for the genuinely exceptional, where a generic message is the honest answer anyway. Worth noting that TypeScript does not catch this migration for you: a result object interpolated into a template literal type-checks happily and renders `[object Object]`.

**The thread running through all four** is that each was invisible in exactly the environment where I was looking. In development the CSP is looser, thrown errors pass through untouched, and a live session skips the sign-in flow. So the rule I took from it is narrow and actionable: **when you add or tighten a security policy, walk every outbound request the browser makes, not only the page loads.** And the broader one, which is the reason this section is the longest in the document: a policy or error-handling choice that behaves differently in development is precisely the kind that ships broken, because the environment that would reveal it is the one you aren't in.

A fifth problem belongs here but is different in kind. A `.vercel.app` subdomain is globally unique, and the name I asked for was taken, so I was silently given a suffixed one. Nothing announced this. I configured the auth callback URL against the domain I *thought* I had, which belongs to a stranger, and sign-in failed with an opaque redirect error that looks exactly like an auth misconfiguration — so the instinct is to debug the wrong layer entirely. Not a bug in any code. An assumption that the name you asked for is the name you got.

---

## A constraint I measured instead of guessing

Late on, the site felt sluggish. The tempting move is to start optimising queries.

I measured first. Warm response time is **0.30–0.56s**. The first request after an idle period is **7.3s**. That gap is not slow code — it's the database auto-suspending, which is how the free tier works. No amount of query tuning fixes a database that has gone to sleep, and there is no always-on option at this price.

So the fix was not to make it faster but to make the wait legible: loading skeletons on every route, plus a pending state on the clicked element itself. That last distinction is the one I'd defend. A spinner somewhere on the page answers "is something loading". It does not answer "did my click register", which is the question a user is actually asking at the moment they click a second time.

---

## What isn't verified

One thing in this project has never been observed working, and it would be dishonest to let the rest of the document imply otherwise.

**Nobody has watched a message arrive in a second browser without a refresh.** Three things around it are verified: the transport, against the live service, including the negative case where an unauthorised publish is refused; the authorisation rule, at the database level, where a seeded conversation is returned to the buyer and to the seller and not to an unrelated third user; and the full thread UI in a single session, in a real browser. None of that adds up to the end-to-end claim. The parts being proven and the whole being proven are different statements, and only the first is currently true.

It stays open for a practical reason: the OAuth client only has `localhost` registered, so the test needs a second person with a real GMI account, against the live site.

---

## One thing I'd do differently with more time

I would write automated tests for the authorization layer.

`src/lib/conversations.ts` is the module that decides who is allowed to read a conversation. It is the only file in `src/lib/` without a test file next to it. Everything else there is pure and covered, 173 tests in total, and five security controls were checked by deliberately reverting each fix in turn to confirm the test that was supposed to catch it actually failed — because a regression test that has never been seen to fail is only an assumption that it works.

The authorization layer got none of that. It was verified by hand against the database, once, and hand-verification does not survive the next change. The reason is mundane rather than principled: it touches the database, so testing it needs a fixture, and every other module was pure enough to test without one. That's an explanation, not a defence. It's the single highest-value gap in the project, and it's the one place where the argument this whole document makes — verify rather than assume — isn't yet honoured in the code.

Two other gaps are real but smaller. The browse grid is capped at 60 listings rather than paginated, which is a bound and not a solution, and would need fixing before real traffic. And there is no way to block or report a user, which a marketplace with actual strangers on it would need on day one; it was scoped out deliberately, not overlooked.

---

*The engineering log, including every decision above in more detail and the version-specific traps that cost real time, is in [`AGENTS.md`](../AGENTS.md).*
