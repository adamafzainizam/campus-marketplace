# The two-person test session

Everything that needs a second GMI account, in the order it has to happen. Roughly an hour.

**Do all of it against the live site:** `https://campus-marketplace-adamafzainizam.vercel.app`. Your friend cannot sign in against a dev server — the Google OAuth client only has `localhost:3000` registered, so `localhost` is not an option for them at all.

**Your friend needs:** a Google account on `@gmi.edu.my` or a subdomain (`@student.gmi.edu.my`). A personal Gmail is refused at sign-in by design.

**Do not make them an administrator.** Half of what is being tested is what the site does to somebody who isn't one.

**The order matters** and is not arbitrary:

- Suspension comes near the end, because a suspended account cannot send messages — doing it earlier would kill the real-time test.
- Screenshots come before suspension, because a suspended seller's listings vanish from the browse page.
- The message-reveal test needs a thread with at least 8 messages in it, which is why step 6 asks you to keep chatting.

---

## Phase 1 — Setup

**1. Your friend signs in.**
Watch for: the sign-in page states the `@gmi.edu.my` requirement *before* the Google account picker, and the consent line linking the Terms and Privacy Policy.
This is the first time anyone but you has been through the domain restriction on production.

**2. Your friend posts a listing, with a photo.**
Watch for: the upload progress bar reaching 100%, then the listing appearing on the home page.
This is a genuinely new test — a browser upload to R2 from a different machine, network, and browser than the one the CORS and CSP rules were built against. If it fails here having worked for you, it is almost certainly the CSP (gotchas #31/#34), not their connection.

---

## Phase 2 — Real-time delivery ⭐

**This is the check outstanding since Week 5-6 and the only one that genuinely cannot be done alone.**

**3.** You open their listing and press **Message seller**.

**4.** They open `/messages` and then the thread. Both of you now have the thread open, on separate devices.

**5. Neither of you refreshes from this point on.** If either does, a message will arrive on page load and the test proves nothing — that is the single rule that decides whether the result is valid.

**6. Send messages both ways — at least 8 in total.**
Watch for: each message appearing on the other screen within a second or so, with no interaction.
The count matters: the reveal test in Phase 4 shows a window of 7 messages, and you need more than 7 in the thread to prove the window is actually bounding anything.

**7. Presence.** Watch for "*their name* is in this chat" while both of you are on the page. Have them navigate away; it should change to "not currently viewing this chat".

**8. Unread badge.** They leave the thread entirely. You send a message. They should see an unread count in the header. Opening the thread clears it.

**If a message does not arrive:** the transport is already proven working against Ably's live service and the authorization is proven at the database level, so a failure here is the wiring between them. Check the browser console for an Ably connection error, and check `/api/ably/token` isn't 401ing.

---

## Phase 3 — Layout

**9.** On the conversation thread, confirm the **site footer is absent**.

**10.** On any other page, confirm the footer **is** present, with the affiliation disclaimer.

**11.** Repeat both on a phone. This is the check that matters most — the footer was suppressed on the thread precisely because on a phone it would eat about a third of the conversation (gotcha #37).

---

## Phase 4 — Reporting

**12. Your friend reports one of your messages.**
Have *them* report *yours*, not the other way round. You know what the thread says, so when you reveal it you can verify the window is exactly right rather than taking it on trust.
Watch for: the reason list, the optional description, and the confirmation. They should *not* be told what will happen next.

**13. Your friend reports one of your listings.** Different target type, same flow.

**14. They try to report the same listing again.** Should be refused — one report per person per thing.

**15. Check their own listing has no report button for them.** You cannot report your own content.

**16.** You open `/admin/reports`.
Watch for: the count badge in the admin nav, both reports listed **oldest first**, and the reason labels matching what they chose.

**17. Open the message report.**
Watch for: it shows who sent the message and when, and **not what it says**. That is deliberate — content requires a separate, deliberate act.

**18. Press "Show the reported message".**
Watch for: the warning first, then **exactly 7 messages** — the reported one highlighted, with 3 either side. Check against what you know is in the thread: the messages beyond that window must not appear.

**19. Open `/admin/log`.**
Watch for: a "Reported message viewed" entry against your name, marked *view only*. Reading was itself recorded.

**20. Resolve the listing report as "action taken"**, with a note.

**21. Resolve the message report as "nothing needed"**, with a note.
Watch for: `/admin/log` now has a "Report dismissed" entry for the second one and **not** for the first — the first refers to an action that logs itself.

**22.** Check the Actioned and Dismissed tabs on `/admin/reports` both show the right report.

---

## Phase 5 — Screenshots

Do these **now**, while the site has two people's listings and a real conversation on it, and before anything is suspended.

Follow [`screenshot-shot-list.md`](./screenshot-shot-list.md) — six shots, target filenames, and the Markdown to paste. Ask your friend before capturing anything with their name or listing in it.

---

## Phase 6 — Suspension (last)

**23. Suspend their account** from `/admin`, with a real reason.

**24.** Their listing disappears from the home page. Check on your screen.

**25.** They see a **red banner** at the top of every page with your reason and an appeal address.

**26.** They try to post a listing — refused. They try to send a message — refused. They try to upload a photo — refused.

**27. They try to report something — this should still work.** Suspension stops someone harming others; reporting harms nobody, so it is deliberately not blocked. If this is refused, that is a bug.

**28.** `/admin/log` shows the suspension with your name, their name, and the reason.

**29. Reinstate them**, with a reason.
Watch for: their listing reappearing on the home page **by itself**, with its own status unchanged — nothing had to be undone. The banner disappears. They can message again.

**30.** `/admin/log` shows **both** entries. The suspension entry is still there — the log is append-only, and reversing an action does not erase it.

---

## Afterwards

- Ask whether they want their test listing left up or archived.
- Their account stays. That is fine; it makes the site look less empty to a recruiter.
- If anything failed, note *which step* — the phases are ordered so a failure localises to one feature rather than to "moderation is broken".
- Update `AGENTS.md`: the two-session real-time test has been outstanding since Week 5-6 and this is what closes it.
