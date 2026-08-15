import "server-only";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  ListingStatus,
  ModerationAction,
  ModerationTargetType,
} from "@/generated/prisma/enums";
import {
  canModerateContent,
  canModerateUser,
  isSuspended,
  type ActorLike,
} from "@/lib/moderation-rules";
import { actionFailed, actionOk, type ActionResult } from "@/lib/action-result";

/**
 * Moderation: the database side of it.
 *
 * Two properties this module exists to guarantee, both structural rather than
 * remembered:
 *
 * 1. **Every moderation write and its audit-log row happen in one
 *    transaction.** There is no exported function that changes something
 *    without writing a log row alongside it, and because both are in the same
 *    transaction, a crash between them cannot leave an unlogged action. The
 *    log is evidence only if it cannot be incomplete.
 *
 * 2. **Role and suspension are read from the database, never from the
 *    session token.** Auth.js uses a JWT strategy here, so a claim baked into
 *    a token stays true until that token expires — meaning a suspended user
 *    would keep their privileges for the life of their session, and a revoked
 *    administrator would keep theirs. One query per privileged request is a
 *    cheap price for suspension taking effect on the *next* request.
 *
 * `server-only` means this module cannot be imported by a test or a standalone
 * script (Known Gotchas #24), which is why everything decidable without a
 * database lives in `moderation-rules.ts` instead.
 */

export type Actor = ActorLike & {
  suspendedAt: Date | null;
  suspendedReason: string | null;
};

/**
 * The signed-in user with their *current* role and suspension state.
 *
 * Returns null when signed out or when the row has since been deleted.
 */
export async function currentActor(): Promise<Actor | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  return db.user.findUnique({
    where: { id },
    select: { id: true, role: true, suspendedAt: true, suspendedReason: true },
  });
}

/**
 * The signed-in administrator, or null for everyone else.
 *
 * Pages use this to decide between rendering and `notFound()`. Deliberately
 * not a throwing `requireAdmin`: a 403 confirms that the route exists, and an
 * admin area that answers differently for "you may not" and "there is nothing
 * here" tells an unauthenticated prober exactly what to keep guessing at.
 */
export async function currentAdmin(): Promise<Actor | null> {
  const actor = await currentActor();
  return actor && actor.role === "ADMIN" ? actor : null;
}

/**
 * Blocks a suspended user from writing.
 *
 * Called at the top of every action that creates or changes something.
 * Suspension is enforced here, on the server, and not by hiding buttons: the
 * form can be submitted without ever loading the page that renders it.
 *
 * Returns null when the caller may proceed.
 */
export async function suspensionBlock(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { suspendedAt: true, suspendedReason: true },
  });

  if (!user || !isSuspended(user)) return null;

  const reason = user.suspendedReason?.trim();
  return actionFailed(
    reason
      ? `Your account is suspended, so you can't do that. Reason: ${reason}`
      : "Your account is suspended, so you can't do that.",
  );
}

/**
 * Suspends a user and records why, in one transaction.
 *
 * The update is scoped to `id` *and* `suspendedAt: null`, so a second
 * suspension of an already-suspended account affects zero rows rather than
 * silently overwriting the original timestamp and reason — the first
 * suspension is the one that should survive in the record.
 */
export async function suspendUser(
  admin: Actor,
  targetId: string,
  reason: string,
): Promise<ActionResult> {
  if (!canModerateUser(admin, targetId)) {
    return actionFailed("You can't take that action.");
  }

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: targetId, suspendedAt: null },
        data: { suspendedAt: new Date(), suspendedReason: reason },
      });
      if (updated.count === 0) {
        throw new NoChange("That user doesn't exist, or is already suspended.");
      }

      await tx.moderationLog.create({
        data: {
          action: ModerationAction.USER_SUSPENDED,
          adminId: admin.id,
          targetType: ModerationTargetType.USER,
          targetId,
          subjectId: targetId,
          reason,
        },
      });
    });
  } catch (error) {
    if (error instanceof NoChange) return actionFailed(error.message);
    throw error;
  }

  return actionOk();
}

/** Lifts a suspension. A reason is required here too — reversals are reviewable as well. */
export async function reinstateUser(
  admin: Actor,
  targetId: string,
  reason: string,
): Promise<ActionResult> {
  if (!canModerateUser(admin, targetId)) {
    return actionFailed("You can't take that action.");
  }

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: targetId, suspendedAt: { not: null } },
        data: { suspendedAt: null, suspendedReason: null },
      });
      if (updated.count === 0) {
        throw new NoChange("That user doesn't exist, or isn't suspended.");
      }

      await tx.moderationLog.create({
        data: {
          action: ModerationAction.USER_REINSTATED,
          adminId: admin.id,
          targetType: ModerationTargetType.USER,
          targetId,
          subjectId: targetId,
          reason,
        },
      });
    });
  } catch (error) {
    if (error instanceof NoChange) return actionFailed(error.message);
    throw error;
  }

  return actionOk();
}

/**
 * Takes a listing down, whoever owns it.
 *
 * `ARCHIVED` rather than a delete, for the reason already in the schema:
 * `Conversation -> Listing` is `onDelete: Restrict`, so deleting a listing
 * with message history is blocked by the database, and destroying somebody's
 * conversation to tidy up a listing would be the wrong trade anyway.
 *
 * Note this cannot reuse `setListingStatus`, which scopes its write to
 * `sellerId` and therefore *structurally* cannot act on another person's
 * listing. That is the correct behaviour for a seller action, so moderation
 * gets its own path rather than the ownership check being loosened.
 */
export async function removeListing(
  admin: Actor,
  listingId: string,
  reason: string,
): Promise<ActionResult> {
  if (!canModerateContent(admin)) {
    return actionFailed("You can't take that action.");
  }

  try {
    await db.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { id: listingId },
        select: { id: true, sellerId: true, status: true },
      });
      if (!listing) throw new NoChange("That listing doesn't exist.");
      if (listing.status === ListingStatus.ARCHIVED) {
        throw new NoChange("That listing has already been removed.");
      }

      await tx.listing.update({
        where: { id: listing.id },
        data: { status: ListingStatus.ARCHIVED },
      });

      await tx.moderationLog.create({
        data: {
          action: ModerationAction.LISTING_REMOVED,
          adminId: admin.id,
          targetType: ModerationTargetType.LISTING,
          targetId: listing.id,
          // The seller, so this shows up in their history rather than only
          // against a listing id that means nothing on its own.
          subjectId: listing.sellerId,
          reason,
        },
      });
    });
  } catch (error) {
    if (error instanceof NoChange) return actionFailed(error.message);
    throw error;
  }

  return actionOk();
}

/** The audit trail, newest first. */
export async function recentModerationLog(take = 100) {
  return db.moderationLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      reason: true,
      createdAt: true,
      admin: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
    },
  });
}

/** Everything ever done to one user, newest first. */
export async function moderationHistoryFor(userId: string, take = 50) {
  return db.moderationLog.findMany({
    where: { subjectId: userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      reason: true,
      createdAt: true,
      admin: { select: { id: true, name: true } },
    },
  });
}

/**
 * Signals "nothing to change" from inside a transaction.
 *
 * Thrown rather than returned because it has to roll the transaction back —
 * returning a failure would leave the log row committed alongside an update
 * that did nothing. It is caught at the boundary and turned into an
 * `ActionFailure`, so it never escapes as a thrown error (Known Gotchas #35).
 */
class NoChange extends Error {}
