import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * The R2 public host that serves listing images. Read from the same env var
 * the app uses at runtime so the CSP can't drift from where images actually
 * come from. Falls back to blocking remote images rather than allowing all of
 * them if the variable is missing.
 */
const r2ImageOrigin = process.env.R2_PUBLIC_URL ?? "";

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
 * `'unsafe-eval'` and the websocket origins are development-only, for React
 * Fast Refresh; they are absent from production builds.
 */
const contentSecurityPolicy = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' blob: data:${r2ImageOrigin ? ` ${r2ImageOrigin}` : ""}`,
  `font-src 'self' data:`,
  // Ably serves realtime over both hostnames; the browser opens a websocket to
  // whichever the SDK selects, so both schemes are needed for each.
  `connect-src 'self' https://*.ably.io wss://*.ably.io https://*.ably-realtime.com wss://*.ably-realtime.com${
    isDev ? " ws://localhost:* http://localhost:*" : ""
  }`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
]
  .join("; ")
  .concat(isDev ? "" : "; upgrade-insecure-requests");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Redundant with frame-ancestors above, kept for older browsers that
  // understand this header but not CSP level 2.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          // HSTS is production-only: sending it from a local http:// dev server
          // would pin localhost to https in the browser and break dev for
          // every other project on this machine.
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]),
        ],
      },
    ];
  },
};

export default nextConfig;
