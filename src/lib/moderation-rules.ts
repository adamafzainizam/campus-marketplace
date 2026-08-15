/**
 * Moderation policy — who may act, on whom, and what must be recorded. No I/O.
 *
 * Split from `moderation.ts` for the same reason `rate-limit-rules.ts` is split
 * from `rate-limit.ts`: the module that touches the database imports
 * `server-only` and therefore cannot be imported by a test or a script at all
 * (Known Gotchas #24). Everything decidable without a database lives here so
 * it can be tested directly.
 *
 * Relative imports with explicit extensions — reached by a test, so the `@/`
 * alias would fail at runtime, transitively as well as directly. Known
 * Gotchas #21 and #23.
 */

import {
  ModerationAction,
  UserRole,
} from "../generated/prisma/enums.ts";
import { type Result } from "./listing-constraints.ts";

/** The minimum a caller must know about an actor to decide what they may do. */
export type ActorLike = {
  id: string;
  role: UserRole;
};

/** The minimum needed to decide whether someone is currently suspended. */
export type SuspendableLike = {
  suspendedAt: Date | null;
  suspendedReason?: string | null;
};

export const MIN_REASON_LENGTH = 5;
export const MAX_REASON_LENGTH = 500;

/**
 * Whether an actor holds administrative privileges.
 *
 * A function rather than an inline `role === "ADMIN"` scattered across pages,
 * so there is exactly one definition of what admin means. If a third role is
 * ever added, this is the place that has to change and the compiler will find
 * the rest.
 */
export function isAdmin(actor: ActorLike | null | undefined): boolean {
  return actor?.role === UserRole.ADMIN;
}

/**
 * Whether a user is currently suspended.
 *
 * `suspendedAt` is the single source of truth; a separate boolean would be a
 * second thing to keep in step, and the two disagreeing is exactly how someone
 * stays suspended forever or slips back in early.
 */
export function isSuspended(user: SuspendableLike | null | undefined): boolean {
  return Boolean(user?.suspendedAt);
}

/**
 * The message a suspended user sees when they try to write something.
 *
 * They are told why. A suspension with no stated reason cannot be appealed,
 * and an unappealable penalty applied by one student to another is not
 * something this project should be able to produce.
 */
export function suspensionMessage(user: SuspendableLike): string {
  const reason = user.suspendedReason?.trim();
  return reason
    ? `Your account is suspended: ${reason}`
    : "Your account is suspended.";
}

/**
 * Whether `actor` may take moderation action against user `targetId`.
 *
 * Two rules, and the second is the one that matters:
 *
 * 1. Only administrators may act at all.
 * 2. **Nobody may act on themselves.** Without this, an administrator can
 *    suspend their own account, and since suspension blocks writes and there
 *    is no route that grants ADMIN, the only way back is a database edit. It
 *    is a self-inflicted lockout with no in-app recovery, so it is refused
 *    rather than merely discouraged.
 */
export function canModerateUser(
  actor: ActorLike | null | undefined,
  targetId: unknown,
): boolean {
  if (!isAdmin(actor)) return false;
  if (typeof targetId !== "string" || targetId.length === 0) return false;
  return actor!.id !== targetId;
}

/**
 * Whether `actor` may act on content (a listing, a message) owned by
 * `ownerId`.
 *
 * Unlike `canModerateUser`, acting on your own *content* is allowed — an
 * administrator taking down their own listing is unremarkable, and refusing it
 * would be a rule with no victim. The self-check exists specifically to
 * prevent a lockout, which content actions cannot cause.
 */
export function canModerateContent(actor: ActorLike | null | undefined): boolean {
  return isAdmin(actor);
}

/**
 * Validates the reason an administrator gives for an action.
 *
 * Required, including for reinstatement. An action with no stated reason is
 * not reviewable later, and reviewability is most of why the log exists —
 * a table of timestamps that does not say *why* answers the least interesting
 * question about any of its rows.
 *
 * Takes `unknown` because it arrives from a form, and a form is user input
 * whatever the type signature claims.
 */
export function validateModerationReason(raw: unknown): Result<string> {
  if (typeof raw !== "string") {
    return { ok: false, error: "A reason is required." };
  }

  const reason = raw.trim();

  if (reason.length < MIN_REASON_LENGTH) {
    return {
      ok: false,
      error: `Give a reason of at least ${MIN_REASON_LENGTH} characters, so this action can be reviewed later.`,
    };
  }
  if (reason.length > MAX_REASON_LENGTH) {
    return {
      ok: false,
      error: `Keep the reason under ${MAX_REASON_LENGTH} characters.`,
    };
  }

  return { ok: true, value: reason };
}

/**
 * Human-readable labels for the audit log.
 *
 * An exhaustive switch rather than a lookup object: adding a value to
 * `ModerationAction` should be a compile error here, not a row that silently
 * renders as "undefined" in the one view whose job is to be readable.
 */
export function moderationActionLabel(action: ModerationAction): string {
  switch (action) {
    case ModerationAction.LISTING_REMOVED:
      return "Listing removed";
    case ModerationAction.USER_SUSPENDED:
      return "User suspended";
    case ModerationAction.USER_REINSTATED:
      return "User reinstated";
    case ModerationAction.MESSAGE_VIEWED:
      return "Reported message viewed";
  }
}

/**
 * Whether an action changed something, as opposed to only observing it.
 *
 * `MESSAGE_VIEWED` is a read. It is logged anyway — that is the whole basis on
 * which moderators are trusted with reported message content — but a log view
 * that presents reading and suspending identically buries the actions that
 * actually did something.
 */
export function isMutatingAction(action: ModerationAction): boolean {
  return action !== ModerationAction.MESSAGE_VIEWED;
}
