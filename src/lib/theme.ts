/**
 * Choosing and remembering a colour theme.
 *
 * No I/O and no React: this module is reached by a test, so its imports would
 * have to be relative with explicit extensions (Gotchas #21/#23) — it happens
 * to need none.
 *
 * The site follows the operating system until somebody presses the button.
 * That is why "system" is not a value here: it is the *absence* of a stored
 * value, handled by CSS rather than by code, so a reader who never touches the
 * button gets exactly the behaviour the site had before this existed.
 */

export type Theme = "light" | "dark";

/** Read by the init script and written by the button. */
export const THEME_STORAGE_KEY = "theme";

/** Stamped on <html>; the stylesheet turns it into a `color-scheme`. */
export const THEME_ATTRIBUTE = "data-theme";

export function nextTheme(current: Theme): Theme {
  return current === "light" ? "dark" : "light";
}

/**
 * Whether a value off `localStorage` is one this site understands.
 *
 * Storage is user-writable and outlives deployments, so a value written by an
 * older version of the site — or by a person poking at devtools — must never
 * reach the attribute. Anything unrecognised means "follow the system".
 */
export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Runs synchronously in <head>, before the first paint.
 *
 * It has to be inline and blocking: anything deferred paints the wrong theme
 * first and corrects it, which is a visible flash on every single page load.
 *
 * Wrapped in try/catch because reading `localStorage` can throw outright in
 * some privacy modes, and a script that throws in <head> is a blank page
 * rather than a wrong colour. Failing silently here is correct — the fallback
 * is the system theme, which is a perfectly good answer.
 *
 * Built from the constants above rather than written out, so the key and the
 * attribute cannot drift from what the button uses; theme.test.ts asserts it.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute(${JSON.stringify(
  THEME_ATTRIBUTE,
)},t)}}catch(e){}`;
