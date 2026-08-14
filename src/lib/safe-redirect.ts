/**
 * Guards post-authentication redirects against becoming an open redirect.
 *
 * `callbackUrl` reaches the sign-in page on the query string, so anyone can
 * choose it. Honouring it unchecked means a link like
 * `/signin?callbackUrl=https://evil.example` bounces a user off-site the
 * instant they authenticate — carrying the trust of our own domain into a
 * phishing page.
 */

/**
 * Reduces an untrusted redirect target to a path within this site, or "/".
 *
 * Rejects, in particular, protocol-relative URLs like `//evil.example`. Those
 * begin with "/" and so slip past the obvious `startsWith("/")` check, while
 * browsers treat them as absolute URLs to another host. The backslash variant
 * `/\evil.example` is normalised the same way by some browsers, so it goes
 * too.
 */
export function safeInternalPath(callbackUrl: unknown): string {
  if (typeof callbackUrl !== "string") return "/";

  const value = callbackUrl.trim();

  if (!value.startsWith("/")) return "/";
  // Protocol-relative ("//host") and its backslash equivalent.
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";

  return value;
}
