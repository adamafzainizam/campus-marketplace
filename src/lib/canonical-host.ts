/**
 * The one address the site is served from, and the old ones that forward to it.
 *
 * `NEXTAUTH_URL` is the canonical origin, so sign-in only works there: a visitor
 * who starts on an old address gets their OAuth state cookie on the wrong host
 * and the callback fails. Redirecting every old host keeps links already shared
 * (the README, the case study, the GMI proposal) working.
 *
 * `campus-marketplace-smoky-xi.vercel.app` is not listed here because Vercel
 * redirects it from the dashboard. This alias is the automatic project-plus-team
 * one, which the dashboard does not list and so cannot redirect.
 */
export const CANONICAL_ORIGIN = "https://gmicmp.vercel.app";

export const LEGACY_HOSTS = ["campus-marketplace-adamafzainizam.vercel.app"];

/**
 * Next compiles a `has` host value into `new RegExp(`^${value}$`)`, so an
 * unescaped dot would match any character. Escaping keeps the match exact.
 */
export function hostPattern(host: string): string {
  return host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function legacyHostRedirects() {
  return LEGACY_HOSTS.map((host) => ({
    source: "/:path*",
    has: [{ type: "host" as const, value: hostPattern(host) }],
    destination: `${CANONICAL_ORIGIN}/:path*`,
    permanent: true,
  }));
}
