/**
 * Who is allowed to sign in.
 *
 * Single source of truth for the institutional-domain rule, shared by the
 * `signIn` callback that enforces it and the sign-in page that tells the user
 * about it. Keeping both on one constant means the UI cannot promise something
 * the callback will reject.
 */

export const ALLOWED_DOMAIN = "gmi.edu.my";

/** The domain as a user-facing email suffix, e.g. for "use your @… account". */
export const ALLOWED_DOMAIN_LABEL = `@${ALLOWED_DOMAIN}` as const;

/**
 * A subdomained address suffix, for showing what a real account looks like:
 * `subdomainLabel("student")` is `@student.gmi.edu.my`.
 *
 * This exists because the sign-in page used to build that example by
 * concatenating the literal `@student` with `ALLOWED_DOMAIN_LABEL`, which
 * already carries its own `@` — so it advertised `@student@gmi.edu.my` and
 * told people the wrong address format on the one page where they act on it.
 *
 * Derived from `ALLOWED_DOMAIN` rather than written out, for the same reason
 * the label is: the UI must not be able to promise a shape the `signIn`
 * callback would reject.
 */
export function subdomainLabel(prefix: string): string {
  return `@${prefix}.${ALLOWED_DOMAIN}`;
}

/**
 * True when an email belongs to the institution.
 *
 * Deliberately an exact match on the domain OR a `.`-prefixed suffix match,
 * never `includes()` (Known Gotchas #4). Real accounts are subdomained —
 * `@student.gmi.edu.my` — so exact-match alone would lock out every student,
 * while `includes()` would admit `gmi.edu.my.attacker.com`. The leading dot in
 * the suffix check is what makes `notgmi.edu.my` fail.
 */
export function isAllowedEmail(email: unknown): boolean {
  if (typeof email !== "string") return false;

  const parts = email.split("@");
  if (parts.length !== 2) return false;

  const domain = parts[1].toLowerCase();
  if (domain.length === 0 || parts[0].length === 0) return false;

  return domain === ALLOWED_DOMAIN || domain.endsWith(`.${ALLOWED_DOMAIN}`);
}
