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
