"use client";

import { THEME_ATTRIBUTE, THEME_STORAGE_KEY, isTheme, nextTheme } from "@/lib/theme";

/**
 * Switches between light and dark, and remembers it.
 *
 * It holds no React state, which is the whole design. The server cannot know
 * which theme a reader has chosen, so anything that renders differently per
 * theme either mismatches during hydration or corrects itself after paint —
 * a flicker on every navigation. Instead both icons and both labels are
 * always rendered and CSS hides one pair, so the server's markup is identical
 * every time and there is nothing to reconcile.
 *
 * For the same reason the click reads the current theme off the DOM rather
 * than from state: `data-theme` is set by a script that ran before React
 * loaded, so the attribute is the truth and React never held it.
 *
 * The icon reports the mode you are *in* rather than the one you would get,
 * which is the less common convention and was chosen deliberately. The
 * accessible name says what the press does, so the two together are
 * unambiguous whether or not you can see the icon.
 *
 * Two tabs open on the site can disagree until one of them reloads — a
 * `storage` event listener would fix that, and was considered and declined:
 * it would reintroduce the React state this component's whole design argues
 * against, to solve a case (two tabs, same site, mid-session) far narrower
 * than the flash-of-wrong-theme this design already solves for every load.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const stored = root.getAttribute(THEME_ATTRIBUTE);

    // No attribute means the reader is still following the system, so read
    // what the system actually resolved to rather than assuming a side.
    const current = isTheme(stored)
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

    const chosen = nextTheme(current);
    root.setAttribute(THEME_ATTRIBUTE, chosen);

    // Storage can throw outright in some privacy modes. The theme still
    // applies for this page; it just will not survive a reload, which is a
    // better outcome than an unhandled error from a button press.
    try {
      localStorage.setItem(THEME_STORAGE_KEY, chosen);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-ghost btn-sm theme-toggle"
      // The icon alone is ambiguous for a sighted mouse user who isn't
      // reading the sr-only label. This doesn't double-announce: a button's
      // accessible name is computed from its content before its title is
      // ever considered, and the visible content here is the sr-only span,
      // so the name a screen reader gets is unchanged — this is purely a
      // hover tooltip for everyone else.
      title="Switch theme"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="theme-icon-sun h-[1.125rem] w-[1.125rem]"
      >
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.6v2.2M12 19.2v2.2M4.35 4.35l1.55 1.55M18.1 18.1l1.55 1.55M2.6 12h2.2M19.2 12h2.2M4.35 19.65l1.55-1.55M18.1 5.9l1.55-1.55" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="theme-icon-moon h-[1.125rem] w-[1.125rem]"
      >
        <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z" />
      </svg>
      {/* Both labels ship; CSS shows the one that matches, the same way the
          icons do. The label names the action even though the icon names the
          state, so a press is never a guess. */}
      <span className="theme-label-dark sr-only">Switch to dark mode</span>
      <span className="theme-label-light sr-only">Switch to light mode</span>
    </button>
  );
}
