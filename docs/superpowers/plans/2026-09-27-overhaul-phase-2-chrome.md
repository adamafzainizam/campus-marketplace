# Overhaul Phase 2: Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the site header (desktop nav with a highlighter mark on the current section; mobile collapses navigation into one dropdown naming the current section), and restyle the footer and breadcrumbs, in the notice-board design.

**Architecture:** A pure `src/lib/site-sections.ts` maps a pathname to a section key and holds the menu items, so the rule is testable without a component framework. `SiteHeader` stays a Server Component (it reads the session) and renders a new client component `HeaderNav`, which reads `usePathname()`. The mobile menu uses the native `popover` attribute: light dismiss, Escape and top-layer stacking come from the browser, so it needs no z-index and cannot disturb the conversation thread's height.

**Tech Stack:** Next.js 16 App Router, React 19 (`popover` / `popoverTarget` props are typed), Tailwind v4, `@phosphor-icons/react` 2.1.10, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-27-notice-board-overhaul-design.md`, section 2 "Phase 2: Chrome". Phase 1's tokens and classes are in place (`--line`, `--highlight`, `--on-highlight`, `--link-decoration`, `--surface-raised`, `--surface-sunken`, `.btn*`, `.chrome` solid with a 2px bottom border, `ICON_WEIGHT` in `src/components/icon-style.ts`).

## Global Constraints

- Branch: `feature/overhaul-2-chrome` (already checked out). Never commit on `main`.
- **Never stage `README.md` or `docs/case-study.md`** (the builder's uncommitted edits). Always `git add` explicit paths.
- Colour only through existing tokens/utilities; no literal colours in components or new CSS.
- In light mode yellow is never text or a hairline on a light surface; a highlighter *fill* with ink text, or a thick (≥4px) highlighter underline beneath ink text, are the approved marks.
- Radius 3px (`var(--radius)` / `rounded`), borders 1.5px, shadows hard offsets. No pills.
- Motion CSS-only; transitions only on `transform`, `box-shadow`, `opacity`, `background-color`, `border-color`.
- Button labels never wrap; the header may wrap as a whole (deliberate floor, keep that comment's reasoning).
- Every interactive element keyboard-operable with a visible focus ring (the global `:focus-visible` provides it; do not suppress it).
- No em-dash (`—`) or en-dash (`–`) in any visible UI string you add. Code comments may use them.
- Do not change the conversation thread page or `.thread-viewport` rules (Known Gotchas #33, #37).
- Tests: relative imports with explicit `.ts` extensions (Gotchas #20, #21, #23).
- Every task ends with `npm test`, `npx tsc --noEmit`, `npx eslint .`, `npx next build` green.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`

## File map

| File | Responsibility | Task |
|---|---|---|
| `src/lib/site-sections.ts` (new) | Section keys, labels, menu items, `currentSection(pathname)` | 1 |
| `src/lib/site-sections.test.ts` (new) | Its tests | 1 |
| `src/components/HeaderNav.tsx` (new) | Client: desktop nav, mobile menu, theme toggle, primary CTA, account | 2 |
| `src/components/SiteHeader.tsx` | Server: session, brand, sign-out action, renders `HeaderNav` | 2 |
| `src/app/globals.css` | `.site-menu`, `.menu-item`, `.menu-sep`, `.site-nav` current mark | 2 |
| `src/components/SiteFooter.tsx` | 1.5px top border | 3 |
| `src/components/Breadcrumbs.tsx` | `/` separator | 3 |

---

### Task 1: Section rules

**Files:**
- Create: `src/lib/site-sections.ts`
- Test: `src/lib/site-sections.test.ts`

**Interfaces:**
- Produces:
  - `type SectionKey = "browse" | "mine" | "messages" | "post" | "signin" | "legal" | "admin"`
  - `SECTION_LABELS: Readonly<Record<SectionKey, string>>`
  - `MENU_ITEMS: ReadonlyArray<{ key: SectionKey; href: string; signedInOnly: boolean }>` (Browse, My listings, Messages, in that order)
  - `currentSection(pathname: string): SectionKey | null`
  - `menuButtonLabel(section: SectionKey | null): string`

- [ ] **Step 1: Write the failing test**

`src/lib/site-sections.test.ts`:
```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  currentSection,
  menuButtonLabel,
  MENU_ITEMS,
  SECTION_LABELS,
  type SectionKey,
} from "./site-sections.ts";

describe("currentSection", () => {
  const cases: Array<[string, SectionKey | null]> = [
    ["/", "browse"],
    ["/listings/cmsvs9e7s0000sj9yo835p86h", "browse"],
    ["/listings/mine", "mine"],
    ["/listings/cmsvs9e7s0000sj9yo835p86h/edit", "mine"],
    ["/listings/new", "post"],
    ["/messages", "messages"],
    ["/messages/cmabc123", "messages"],
    ["/signin", "signin"],
    ["/legal", "legal"],
    ["/legal/terms", "legal"],
    ["/admin", "admin"],
    ["/admin/reports/abc", "admin"],
    ["/somewhere-unknown", null],
  ];
  for (const [path, expected] of cases) {
    it(`maps ${path} to ${expected}`, () => {
      assert.equal(currentSection(path), expected);
    });
  }

  it("ignores a trailing slash", () => {
    assert.equal(currentSection("/messages/"), "messages");
    assert.equal(currentSection("/listings/mine/"), "mine");
  });

  it("does not treat a prefix of a word as the section", () => {
    // "/messagesx" is not the messages section; nor is "/legalese".
    assert.equal(currentSection("/messagesx"), null);
    assert.equal(currentSection("/legalese"), null);
  });
});

describe("the menu", () => {
  it("lists Browse, My listings and Messages, in that order", () => {
    assert.deepEqual(
      MENU_ITEMS.map((item) => item.key),
      ["browse", "mine", "messages"],
    );
  });

  it("only offers My listings to someone signed in", () => {
    const mine = MENU_ITEMS.find((item) => item.key === "mine");
    assert.equal(mine?.signedInOnly, true);
    for (const item of MENU_ITEMS.filter((i) => i.key !== "mine")) {
      assert.equal(item.signedInOnly, false, `${item.key} should be public`);
    }
  });

  it("marks each item as current on its own page", () => {
    // Ties the hrefs to the section rules: a renamed route that the rules
    // no longer recognise would leave the menu unable to mark itself.
    for (const item of MENU_ITEMS) {
      assert.equal(currentSection(item.href), item.key, `${item.href}`);
    }
  });
});

describe("menuButtonLabel", () => {
  it("names the section you are in", () => {
    assert.equal(menuButtonLabel("mine"), SECTION_LABELS.mine);
    assert.equal(menuButtonLabel("messages"), SECTION_LABELS.messages);
  });

  it("says Menu on the post page and on unknown pages", () => {
    // On /listings/new the primary button already reads "Post a listing";
    // a second copy in the menu button would overflow a 360px header.
    assert.equal(menuButtonLabel("post"), "Menu");
    assert.equal(menuButtonLabel(null), "Menu");
  });

  it("uses no dash characters in any label", () => {
    for (const label of [...Object.values(SECTION_LABELS), menuButtonLabel(null)]) {
      assert.ok(!/[—–]/.test(label), label);
    }
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/lib/site-sections.test.ts`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./site-sections.ts`.

- [ ] **Step 3: Implement**

`src/lib/site-sections.ts`:
```ts
/**
 * Which part of the site a path belongs to — no I/O, no JSX.
 *
 * The mobile header's menu button names the page you are on, and both the
 * menu and the desktop nav mark the current section. That needs the path,
 * which is why the header's nav is a client component; the rule itself lives
 * here so it can be tested.
 *
 * Unlike breadcrumbs (src/lib/breadcrumbs.ts), which are declared per page
 * because `/listings/<id>` does not contain the listing's title, sections are
 * a fixed handful of path prefixes, so deriving them from the URL is safe.
 */

export type SectionKey =
  | "browse"
  | "mine"
  | "messages"
  | "post"
  | "signin"
  | "legal"
  | "admin";

export const SECTION_LABELS: Readonly<Record<SectionKey, string>> = {
  browse: "Browse",
  mine: "My listings",
  messages: "Messages",
  post: "Post a listing",
  signin: "Sign in",
  legal: "Legal",
  admin: "Admin",
};

/** The mobile menu's navigation, in display order. */
export const MENU_ITEMS: ReadonlyArray<{
  key: SectionKey;
  href: string;
  signedInOnly: boolean;
}> = [
  { key: "browse", href: "/", signedInOnly: false },
  { key: "mine", href: "/listings/mine", signedInOnly: true },
  { key: "messages", href: "/messages", signedInOnly: false },
];

/** True when `path` is `prefix` itself or a path beneath it. */
function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function currentSection(pathname: string): SectionKey | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (path === "/") return "browse";
  if (under(path, "/listings/mine")) return "mine";
  if (path === "/listings/new") return "post";
  // A listing's edit page belongs to the seller's own listings.
  if (/^\/listings\/[^/]+\/edit$/.test(path)) return "mine";
  if (under(path, "/listings")) return "browse";
  if (under(path, "/messages")) return "messages";
  if (path === "/signin") return "signin";
  if (under(path, "/legal")) return "legal";
  if (under(path, "/admin")) return "admin";
  return null;
}

/**
 * What the mobile menu button says. "Menu" on the post page, where the
 * primary button beside it already says "Post a listing", and anywhere the
 * section is unknown.
 */
export function menuButtonLabel(section: SectionKey | null): string {
  if (section === null || section === "post") return "Menu";
  return SECTION_LABELS[section];
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/lib/site-sections.test.ts`
Expected: PASS, every case.

- [ ] **Step 5: Full verification, commit, mutation**

```bash
npm test && npx tsc --noEmit && npx eslint . && npx next build
git add src/lib/site-sections.ts src/lib/site-sections.test.ts
git commit -m "Map paths to header sections

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
Then mutate: change `under(path, "/messages")` to `path.startsWith("/messages")`, run the test (expected FAIL on `/messagesx`), revert with `git checkout src/lib/site-sections.ts`.

**Report:** RED/GREEN output, verification tails, mutation result.

---

### Task 2: Header

**Files:**
- Create: `src/components/HeaderNav.tsx`
- Modify: `src/components/SiteHeader.tsx` (whole file)
- Modify: `src/app/globals.css` (add rules inside `@layer components`, after the `.theme-toggle` rules)

**Interfaces:**
- Consumes (Task 1): `currentSection`, `menuButtonLabel`, `MENU_ITEMS`, `SECTION_LABELS`, `SectionKey` from `@/lib/site-sections`. Existing: `PendingLink` (`@/components/PendingLink`; passes extra props such as `aria-current` through to `next/link`), `ThemeToggle`, `ICON_WEIGHT`, `PinMark`, `auth` / `signOut` from `@/auth`.
- Produces: `HeaderNav({ userLabel, signOut }: { userLabel: string | null; signOut: () => Promise<void> })`.

- [ ] **Step 1: Add the CSS**

In `src/app/globals.css`, inside `@layer components`, directly after the last `:root[data-theme="light"] .theme-label-dark` rule:

```css
  /* Mobile site menu.
     A native popover: the browser supplies light dismiss, Escape and the top
     layer, so it needs no z-index and draws over the page without taking
     any of its height (the conversation thread is sized to the viewport and
     has broken twice from root-layout changes; Known Gotchas #33, #37).
     The UA stylesheet centres a popover with `inset: 0; margin: auto`, so
     both are reset before placing it under the header's left edge. */
  .site-menu {
    position: fixed;
    inset: auto;
    top: 3.75rem;
    left: 0.75rem;
    margin: 0;
    width: min(15rem, calc(100vw - 1.5rem));
    padding: 0.375rem;
    background: var(--surface-raised);
    color: var(--text);
    border: 1.5px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-md);
  }

  .menu-item {
    display: flex;
    width: 100%;
    align-items: center;
    min-height: 2.75rem;
    padding: 0.5rem 0.625rem;
    border-radius: var(--radius);
    font-size: 0.9375rem;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    background: transparent;
    transition: background-color var(--response-fast) var(--ease-out);
  }
  @media (hover: hover) {
    .menu-item:hover { background: var(--surface-sunken); }
  }
  /* The page you are on, marked the way you would mark it on paper. */
  .menu-item[aria-current="page"],
  .menu-item[aria-current="page"]:hover {
    background: var(--highlight);
    color: var(--on-highlight);
    font-weight: 800;
  }

  .menu-sep {
    margin: 0.375rem 0.25rem;
    border: 0;
    border-top: 1.5px dashed var(--line);
  }

  /* Desktop nav: the current section gets a thick highlighter underline
     beneath ink text, the same mark as links, so it says "you are here"
     without competing with the yellow-on-ink primary button. The inner span
     is targeted too because PendingLink wraps the label in one, and
     decoration does not always propagate into a flex item. */
  .site-nav a[aria-current="page"],
  .site-nav a[aria-current="page"] > span {
    color: var(--text);
    font-weight: 800;
    text-decoration-line: underline;
    text-decoration-color: var(--link-decoration);
    text-decoration-thickness: 4px;
    text-underline-offset: 6px;
  }
```

- [ ] **Step 2: Create `HeaderNav.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CaretDownIcon } from "@phosphor-icons/react";
import { PendingLink } from "@/components/PendingLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ICON_WEIGHT } from "@/components/icon-style";
import {
  currentSection,
  menuButtonLabel,
  MENU_ITEMS,
  SECTION_LABELS,
  type SectionKey,
} from "@/lib/site-sections";

const MENU_ID = "site-menu";

/**
 * Everything in the header after the brand: navigation, the theme toggle,
 * the one primary action, and the account.
 *
 * A client component only because marking the current section needs the
 * path. The session is read by SiteHeader, a Server Component, and handed
 * down as `userLabel` (null when signed out) and a sign-out server action.
 *
 * Below `sm` the navigation collapses into one menu whose button names the
 * page you are on. "Post a listing" and the theme toggle stay outside it:
 * the primary action inside a menu would be indistinguishable from
 * navigation. The full labels ("My listings", "Post a listing") replace the
 * old phone abbreviations, because a menu has room for them.
 */
export function HeaderNav({
  userLabel,
  signOut,
}: {
  userLabel: string | null;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const section = currentSection(pathname);
  const menuRef = useRef<HTMLDivElement>(null);
  const signedIn = userLabel !== null;

  // The header persists across navigations, so an open menu would stay open
  // on the next page. Close it whenever the path changes. hidePopover() is a
  // no-op on a closed popover.
  useEffect(() => {
    menuRef.current?.hidePopover?.();
  }, [pathname]);

  const current = (key: SectionKey) => (section === key ? "page" : undefined);
  const items = MENU_ITEMS.filter((item) => signedIn || !item.signedInOnly);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        popoverTarget={MENU_ID}
        className="btn btn-secondary btn-sm sm:hidden"
      >
        <span className="sr-only">Site menu, current page: </span>
        {menuButtonLabel(section)}
        <CaretDownIcon weight={ICON_WEIGHT} aria-hidden="true" className="h-3.5 w-3.5" />
      </button>

      <div id={MENU_ID} ref={menuRef} popover="auto" className="site-menu sm:hidden">
        <nav aria-label="Site">
          {items.map((item) => (
            <PendingLink
              key={item.key}
              href={item.href}
              className="menu-item"
              aria-current={current(item.key)}
            >
              {SECTION_LABELS[item.key]}
            </PendingLink>
          ))}
        </nav>
        <hr className="menu-sep" />
        {signedIn ? (
          <>
            <p className="px-2.5 pt-1 text-fine text-secondary">
              Signed in as {userLabel}
            </p>
            <form action={signOut}>
              <button type="submit" className="menu-item">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <PendingLink href="/signin" className="menu-item" aria-current={current("signin")}>
            Sign in
          </PendingLink>
        )}
      </div>

      {/* Wraps rather than overflowing, as a floor: someone running large
          type can exceed any width budget, and a taller header is survivable
          where horizontal page scroll is not. Wrapping rather than scrolling
          because a scroll container clips the focus ring drawn outside each
          button. */}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
        <nav aria-label="Primary" className="site-nav hidden items-center gap-1 sm:flex">
          {signedIn && (
            <PendingLink
              href="/listings/mine"
              className="btn btn-ghost btn-sm"
              aria-current={current("mine")}
            >
              {SECTION_LABELS.mine}
            </PendingLink>
          )}
          <PendingLink
            href="/messages"
            className="btn btn-ghost btn-sm"
            aria-current={current("messages")}
          >
            {SECTION_LABELS.messages}
          </PendingLink>
        </nav>

        <ThemeToggle />

        <PendingLink
          href="/listings/new"
          className="btn btn-primary btn-sm"
          aria-current={current("post")}
        >
          {SECTION_LABELS.post}
        </PendingLink>

        <div className="hidden items-center gap-2 sm:flex">
          {signedIn ? (
            <>
              <span className="hidden max-w-[9rem] truncate text-fine text-secondary lg:inline">
                {userLabel}
              </span>
              <form action={signOut}>
                <button type="submit" className="btn btn-ghost btn-sm">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <PendingLink
              href="/signin"
              className="btn btn-ghost btn-sm"
              aria-current={current("signin")}
            >
              {SECTION_LABELS.signin}
            </PendingLink>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `SiteHeader.tsx`**

```tsx
import Link from "next/link";
import { HeaderNav } from "@/components/HeaderNav";
import { PinMark } from "@/components/PinMark";
import { auth, signOut } from "@/auth";

/**
 * Site-wide header: the brand, then everything in HeaderNav.
 *
 * Solid, like paper, with the notice board's 2px ink rule beneath it
 * (`.chrome`). This stays a Server Component because it reads the session;
 * HeaderNav is the client part, because marking the current section needs
 * the path.
 *
 * The wordmark hides below `sm`, which is the whole reason to own a mark:
 * the words cannot shrink past "Marketplace", and on a 360px phone the
 * header has no room for them beside the menu, the theme toggle and
 * "Post a listing".
 */
export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;
  const userLabel = user ? (user.name ?? user.email ?? "your account") : null;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <header className="chrome sticky top-0 z-50">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center gap-2 px-3 py-2 sm:min-h-16 sm:gap-3 sm:px-6">
        <Link
          href="/"
          className="pressable flex shrink-0 items-center gap-2 text-base font-extrabold"
        >
          <PinMark />
          <span className="hidden sm:inline">GMI Campus Marketplace</span>
          <span className="sr-only sm:hidden">GMI Campus Marketplace</span>
        </Link>
        <HeaderNav userLabel={userLabel} signOut={signOutAction} />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Verify**

```bash
npm test && npx tsc --noEmit && npx eslint . && npx next build
ls .next/static/chunks/*.css
grep -o "site-menu[^{]*{[^}]*}" .next/static/chunks/*.css | head -2
grep -c "aria-current=page\|aria-current=\"page\"" .next/static/chunks/*.css
```
Expected: green; the `.site-menu` rule present in the built CSS; the `aria-current` selector count ≥ 1 in at least one file. Then start the production server (`npx next start -p 3100`, in the background) and fetch `/` signed out:
```bash
curl -s localhost:3100/ | grep -o 'popover="auto"\|popovertarget="site-menu"\|aria-current="page"' | sort | uniq -c
```
Expected: one `popover="auto"`, one `popovertarget="site-menu"`, and at least one `aria-current="page"` (Browse in the menu). Stop the server afterwards (find its PID with `pgrep -f "next-server"` and `kill` it; do **not** use `pkill -f` with a pattern that also matches your own shell command).

- [ ] **Step 5: Commit**

```bash
git add src/components/HeaderNav.tsx src/components/SiteHeader.tsx src/app/globals.css
git commit -m "Rebuild the header: mobile menu and a marked current section

Below sm, navigation collapses into a native popover whose button names
the current page; Post a listing and the theme toggle stay outside it.
On desktop the current section gets a highlighter underline.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**Report:** verification tails, the built-CSS and curl grep outputs, anything in the brief you had to deviate from and why.

---

### Task 3: Footer and breadcrumbs

**Files:**
- Modify: `src/components/SiteFooter.tsx:25` (the `<footer className=...>`)
- Modify: `src/components/Breadcrumbs.tsx` (the separator)

- [ ] **Step 1: Footer border**

Change `className="mt-auto border-t border-line bg-surface-sunken"` to `className="mt-auto border-t-[1.5px] border-line bg-surface-sunken"`. In the component comment, replace "Deliberately not sticky and not translucent, unlike the header." with "Deliberately not sticky, unlike the header."

- [ ] **Step 2: Breadcrumb separator**

In `Breadcrumbs.tsx`, change the separator character `›` to `/`, and the doc comment's example from `"Home › Listings › Mini fridge"` to `"Home / Listings / Mini fridge"`.

- [ ] **Step 3: Verify and commit**

```bash
npm test && npx tsc --noEmit && npx eslint . && npx next build
grep -rn "›" src --include=*.tsx
git add src/components/SiteFooter.tsx src/components/Breadcrumbs.tsx
git commit -m "Footer rule and slash breadcrumbs for the notice board

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
Expected: green; the `›` grep prints nothing.

**Report:** verification tails and the grep output.

---

### Task 4: Phase verification and records (controller, not a subagent)

- [ ] Full verification on the branch tip.
- [ ] Production server, forced-scheme screenshots (Gotcha #52) at 360, 375 and 1280, light and dark: `/`, `/signin`, `/legal/terms`, a listing detail. Open the mobile menu for a capture by driving headless Chrome over the DevTools protocol (Node 24 has a global `WebSocket`) and calling `document.getElementById('site-menu').showPopover()` before `Page.captureScreenshot`. Check: nothing wraps at 360 or 375 signed out; the menu sits under the header's left edge; the current item is filled; the desktop current link is underlined; focus rings visible.
- [ ] AGENTS.md: Current State (Phase 2 in review), Decision Log (popover API for the menu; `menuButtonLabel` says "Menu" on the post page; unread badge dropped), Next Steps (Phase 3).
- [ ] Builder walk list for signed-in states: the header at 360px signed in (the widest state: "My listings" as the menu label), the menu open on a conversation thread (must not change the thread's height), sign out from the mobile menu.
- [ ] PR against `feature/overhaul-1-foundation` while #50 is open (retarget to `main` once it merges).
