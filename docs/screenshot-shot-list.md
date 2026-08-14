# Screenshot shot-list

The last outstanding piece of Week 8. Everything here needs a real browser against the live site, so it's a manual job — this document exists so it's mechanical rather than another round of decisions.

**Capture against production:** `https://campus-marketplace-adamafzainizam.vercel.app`, signed in with your GMI account. Not localhost — the URL bar is visible in a browser-chrome shot and `localhost:3000` in a portfolio README undercuts the "it's actually deployed" point.

**Before you start:** post two or three listings with decent photos, at least one of them a rental, and make sure one is marked `RESERVED` or `SOLD`. An empty grid is a worse advert than no screenshot. Warm the site up with a page load first, or the first shot will catch a loading skeleton (7.3s cold start — see the case study).

---

## The shots

Save everything to `docs/images/`. That directory doesn't exist yet; create it.

| # | Page | State to capture | Save as | Why this one |
|---|---|---|---|---|
| 1 | `/` | Browse grid, several listings, one visibly "For rent" and one marked sold/reserved | `browse.png` | The hero shot. This is the one that goes at the top of the README |
| 2 | `/` | Same grid on a phone-width viewport | `browse-mobile.png` | Backs up the "works on a phone" claim, which is otherwise just a sentence |
| 3 | `/listings/[id]` | A rental listing, so the price reads `RM 20 / week` with the "For rent" badge | `listing-detail.png` | Shows the rental data model doing something visible |
| 4 | `/messages/[id]` | An open thread with messages from both sides | `messaging.png` | The most technically interesting feature; needs to look real, so seed a few messages |
| 5 | `/listings/mine` | Your listings with the status controls visible | `seller-controls.png` | Shows there's more than a read-only catalogue |
| 6 | `/signin` | The sign-in page, with the `@gmi.edu.my` requirement stated | `signin.png` | Optional. Explains the trust model in one image |

**Dark mode:** optional, but a light/dark pair of shot #1 makes the design-system work legible in a way prose can't. If you do it, name it `browse-dark.png`.

**Sizing:** 1440px wide for desktop shots, ~390px for the mobile one. Crop out browser chrome unless the URL is the point. Keep each file under ~500KB — GitHub serves these on every README view.

---

## Markdown to paste

**In `README.md`**, directly under the "Live:" line near the top:

```markdown
![The browse page, showing listings for sale and for rent](./docs/images/browse.png)
```

**In `README.md`**, at the end of the "What works so far" section:

```markdown
### Screens

| Browse and filter | A listing |
|---|---|
| ![Browse page](./docs/images/browse.png) | ![Listing detail, showing a rental priced per week](./docs/images/listing-detail.png) |

| Buyer–seller messaging | Managing your own listings |
|---|---|
| ![A conversation thread](./docs/images/messaging.png) | ![The seller's listing management page](./docs/images/seller-controls.png) |

On a phone:

<img src="./docs/images/browse-mobile.png" alt="The browse page on a phone" width="320">
```

The alt text is written out rather than left as "screenshot" on purpose — it's read aloud by screen readers, and an accessibility pass was part of the design work.

---

## After

Update the README roadmap row for Week 8 (currently `Case study done; screenshots outstanding`) and drop this file, or mark it done. Then the only thing left in the whole 8-week plan is the two-session real-time delivery test in [`week7-deployment-runbook.md`](./week7-deployment-runbook.md).
