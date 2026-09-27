"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CaretDownIcon } from "@phosphor-icons/react";
import { PendingLink } from "@/components/PendingLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ICON_WEIGHT } from "@/components/icon-style";
import {
  ariaCurrentFor,
  currentSection,
  menuButtonAccessiblePrefix,
  menuButtonLabel,
  MENU_ITEMS,
  SECTION_LABELS,
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

  // The effect above only fires when the pathname itself changes, so it
  // misses a tap on the item for the page you are already on (a query
  // string changing, or the section's own href) - the menu would otherwise
  // stay open. Close it immediately in that case; for a different path,
  // leave it to the effect, so the pending indicator stays visible while the
  // next page loads.
  const closeMenuIfSamePath = (href: string) => {
    if (href === pathname) menuRef.current?.hidePopover?.();
  };

  const items = MENU_ITEMS.filter((item) => signedIn || !item.signedInOnly);
  const accessiblePrefix = menuButtonAccessiblePrefix(section);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        popoverTarget={MENU_ID}
        className="btn btn-secondary btn-sm gap-1 px-2 sm:hidden"
      >
        {accessiblePrefix !== null && (
          <span className="sr-only">{accessiblePrefix}</span>
        )}
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
              aria-current={ariaCurrentFor(pathname, item.key, item.href)}
              onClick={() => closeMenuIfSamePath(item.href)}
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
            <form
              action={signOut}
              onSubmit={() => menuRef.current?.hidePopover?.()}
            >
              <button type="submit" className="menu-item">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <PendingLink
            href="/signin"
            className="menu-item"
            aria-current={ariaCurrentFor(pathname, "signin", "/signin")}
            onClick={() => closeMenuIfSamePath("/signin")}
          >
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
        <nav aria-label="Site" className="site-nav hidden items-center gap-1 sm:flex">
          {signedIn && (
            <PendingLink
              href="/listings/mine"
              className="btn btn-ghost btn-sm"
              aria-current={ariaCurrentFor(pathname, "mine", "/listings/mine")}
            >
              {SECTION_LABELS.mine}
            </PendingLink>
          )}
          <PendingLink
            href="/messages"
            className="btn btn-ghost btn-sm"
            aria-current={ariaCurrentFor(pathname, "messages", "/messages")}
          >
            {SECTION_LABELS.messages}
          </PendingLink>
        </nav>

        <ThemeToggle />

        <PendingLink
          href="/listings/new"
          className="btn btn-primary btn-sm"
          aria-current={ariaCurrentFor(pathname, "post", "/listings/new")}
        >
          {SECTION_LABELS.post}
        </PendingLink>

        <div className="site-nav hidden items-center gap-2 sm:flex">
          {signedIn ? (
            <>
              <span
                className="hidden max-w-[9rem] truncate text-fine text-secondary lg:inline"
                title={userLabel}
              >
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
              aria-current={ariaCurrentFor(pathname, "signin", "/signin")}
            >
              {SECTION_LABELS.signin}
            </PendingLink>
          )}
        </div>
      </div>
    </div>
  );
}
