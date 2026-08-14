/**
 * Security response headers, as pure functions of the environment.
 *
 * Extracted from `next.config.ts` so the policy can be tested. That is not
 * ceremony: `form-action 'self'` silently broke Google sign-in in production
 * for a day, and nothing in the build, the type checker, or the test suite
 * could have caught it, because the policy was a string literal inside a
 * config file. It is a security control, so it gets tests like every other
 * security control in this codebase.
 */

/**
 * Where Auth.js sends the browser to begin the OAuth flow.
 *
 * This must appear in `form-action`. The sign-in form posts to our own origin
 * and the server answers with a 302 to Google — and browsers apply
 * `form-action` to the *redirect target* of a form submission, not only to the
 * URL in the `action` attribute. Without this the redirect is blocked and the
 * sign-in button appears to do nothing at all.
 */
export const GOOGLE_AUTH_ORIGIN = "https://accounts.google.com";

export type SecurityHeaderOptions = {
  isDev: boolean;
  /** Value of R2_PUBLIC_URL; empty string when unset. */
  r2ImageOrigin: string;
};

/**
 * Content-Security-Policy.
 *
 * Two deliberate relaxations, recorded rather than left implicit:
 *
 * - `'unsafe-inline'` in script-src. Next.js injects an inline bootstrap
 *   script. Removing it requires a nonce, which requires middleware on every
 *   request, which opts every route out of static rendering. For an app whose
 *   only user-generated content is rendered as escaped text through JSX, that
 *   trade is not worth the cost. Revisit if untrusted HTML is ever rendered.
 * - `'unsafe-inline'` in style-src, which Tailwind and Next's style injection
 *   both need.
 *
 * `'unsafe-eval'` and the localhost websocket origins are development-only,
 * for React Fast Refresh; they are absent from production builds.
 */
export function buildContentSecurityPolicy({
  isDev,
  r2ImageOrigin,
}: SecurityHeaderOptions): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    // Falls back to blocking remote images rather than allowing all of them if
    // R2_PUBLIC_URL is missing at build time.
    `img-src 'self' blob: data:${r2ImageOrigin ? ` ${r2ImageOrigin}` : ""}`,
    `font-src 'self' data:`,
    // Ably serves realtime over both hostnames; the browser opens a websocket
    // to whichever the SDK selects, so both schemes are needed for each.
    `connect-src 'self' https://*.ably.io wss://*.ably.io https://*.ably-realtime.com wss://*.ably-realtime.com${
      isDev ? " ws://localhost:* http://localhost:*" : ""
    }`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    // 'self' covers every form in the app; Google is required for the OAuth
    // redirect only. Kept to an explicit origin rather than a wildcard.
    `form-action 'self' ${GOOGLE_AUTH_ORIGIN}`,
    `object-src 'none'`,
  ]
    .join("; ")
    .concat(isDev ? "" : "; upgrade-insecure-requests");
}

export function buildSecurityHeaders(
  options: SecurityHeaderOptions,
): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(options) },
    // Redundant with frame-ancestors above, kept for older browsers that
    // understand this header but not CSP level 2.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
    // HSTS is production-only: sending it from a local http:// dev server
    // would pin localhost to https in the browser and break dev for every
    // other project on this machine.
    ...(options.isDev
      ? []
      : [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ]),
  ];
}
