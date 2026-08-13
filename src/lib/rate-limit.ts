import "server-only";

import { db } from "@/lib/db";
import {
  isWithinLimit,
  rateLimitKey,
  rateLimitRuleFor,
  retryAfterSeconds,
  windowEndFrom,
  type RateLimitAction,
} from "@/lib/rate-limit-rules";

export { RATE_LIMITS, type RateLimitAction } from "@/lib/rate-limit-rules";

/**
 * Applies the rate-limit policy, backed by Postgres.
 *
 * Stored in the database rather than an in-memory Map because Week 7 deploys
 * to Vercel: consecutive requests may land on different serverless instances,
 * and instances cold-start freely. An in-memory counter would hand an attacker
 * a fresh budget per instance — protection that looks convincing in
 * development and is close to worthless in production.
 */

export type RateLimitOutcome =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfter: number };

type CounterRow = { count: number; windowEnd: Date };

export async function consumeRateLimit(
  action: RateLimitAction,
  userId: string,
): Promise<RateLimitOutcome> {
  const rule = rateLimitRuleFor(action);
  const now = new Date();
  const key = rateLimitKey(action, userId);
  const freshWindowEnd = windowEndFrom(now, rule.windowMs);

  // The increment and the window reset happen in one statement so two
  // concurrent requests cannot both read a stale count and both be let
  // through. Read-then-write in application code would be a textbook race, and
  // a rate limiter is exactly the thing an attacker races.
  const rows = await db.$queryRaw<CounterRow[]>`
    INSERT INTO rate_limits (key, count, "windowEnd")
    VALUES (${key}, 1, ${freshWindowEnd})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits."windowEnd" <= NOW() THEN 1
        ELSE rate_limits.count + 1
      END,
      "windowEnd" = CASE
        WHEN rate_limits."windowEnd" <= NOW() THEN ${freshWindowEnd}
        ELSE rate_limits."windowEnd"
      END
    RETURNING count, "windowEnd"
  `;

  const row = rows[0];
  if (!row) {
    // The statement always returns a row. If that ever stops being true, fail
    // closed rather than silently granting unlimited access.
    return { allowed: false, retryAfter: 60 };
  }

  if (!isWithinLimit(row.count, rule)) {
    return { allowed: false, retryAfter: retryAfterSeconds(row.windowEnd, now) };
  }

  return { allowed: true, remaining: rule.limit - row.count };
}
