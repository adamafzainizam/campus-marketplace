/**
 * Rate-limit policy and arithmetic — no I/O.
 *
 * Split from `rate-limit.ts` so the rules can be tested without a database.
 * `rate-limit.ts` holds the single SQL statement that applies them; everything
 * about *what* the limits are and *how* a window advances lives here.
 */

export type RateLimitRule = { limit: number; windowMs: number };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Limits are per user, per rolling window: set well above normal use and well
 * below what would threaten a free tier.
 *
 * The upload limit is the load-bearing one. R2's free tier is 10GB and
 * Cloudflare has no hard spending cap (Known Gotchas #8), so an unbounded mint
 * endpoint is a direct path to a bill. At 30/hour and a 5MB cap, one account
 * can move at most ~150MB/hour instead of being limited only by bandwidth.
 *
 * That 30 is **derived, not chosen**: the listing limit is 10/hour and
 * `MAX_LISTING_PHOTOS` is 3, so 30 is exactly what posting at full rate
 * requires. **The two must move together.** Raising the photo cap alone
 * rebuilds a wall sellers hit, and this comment is the only thing that says
 * so — it was 20 when one listing meant one upload, and the meaning of the
 * number changed underneath it when photos became a list.
 */
export const RATE_LIMITS = {
  upload: { limit: 30, windowMs: HOUR },
  listing: { limit: 10, windowMs: HOUR },
  message: { limit: 60, windowMs: MINUTE },
  conversation: { limit: 20, windowMs: HOUR },
  /**
   * Reporting is rate limited too, though the harm it bounds is different.
   * There is no cost in storage or money — the scarce resource is the
   * moderator's queue, and one person filing continuously would bury genuine
   * reports under noise. Set well above any honest use: nobody encounters ten
   * rule-breaking listings in an hour.
   */
  report: { limit: 10, windowMs: HOUR },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitAction = keyof typeof RATE_LIMITS;

/**
 * Guarded with `Object.hasOwn` for the same reason as every other allowlist in
 * this codebase (Known Gotchas #15): a bare lookup would resolve inherited
 * keys like "constructor" to a truthy value, and here that would mean applying
 * an undefined limit — failing open.
 */
export function rateLimitRuleFor(action: RateLimitAction): RateLimitRule {
  if (!Object.hasOwn(RATE_LIMITS, action)) {
    throw new Error(`Unknown rate limit action: ${String(action)}`);
  }
  return RATE_LIMITS[action];
}

/**
 * Keys are namespaced by action so one action's budget cannot consume
 * another's. `:` cannot appear in a cuid, so keys can't collide by
 * construction.
 */
export function rateLimitKey(action: RateLimitAction, userId: string): string {
  return `${action}:${userId}`;
}

export function windowEndFrom(now: Date, windowMs: number): Date {
  return new Date(now.getTime() + windowMs);
}

/** The count includes the request being decided, so the check is inclusive. */
export function isWithinLimit(count: number, rule: RateLimitRule): boolean {
  return count <= rule.limit;
}

/** Never returns 0 — a Retry-After of 0 invites an immediate retry storm. */
export function retryAfterSeconds(windowEnd: Date, now: Date): number {
  return Math.max(1, Math.ceil((windowEnd.getTime() - now.getTime()) / 1000));
}
