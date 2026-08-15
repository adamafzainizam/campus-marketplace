import "server-only";

import { db } from "@/lib/db";
import {
  ModerationAction,
  ModerationTargetType,
  ReportStatus,
  type ReportReason,
} from "@/generated/prisma/enums";
import {
  canReport,
  messageContextWindow,
  type ReportableTargetType,
} from "@/lib/report-rules";
import { canModerateContent, type ActorLike } from "@/lib/moderation-rules";
import type { Actor } from "@/lib/moderation";
import { actionFailed, actionOk, type ActionResult } from "@/lib/action-result";

/**
 * Reports: raising them, triaging them, and the one privileged read in the
 * whole application.
 *
 * The design rule this module exists to enforce: **a moderator can see a
 * reported message and a little of what surrounds it, and nothing else.**
 * There is no function here that returns a whole conversation, and the
 * windowing is done by the database rather than by slicing a full thread in
 * memory — fetching everything and discarding most of it would mean the
 * private messages had already been read out of the database, which is exactly
 * what the limit exists to prevent.
 *
 * `server-only`, so it cannot be imported by a test (Known Gotchas #24);
 * everything decidable without a database lives in `report-rules.ts`.
 */

/** Who owns the thing being reported, so self-reports can be refused. */
async function ownerOf(
  targetType: ReportableTargetType,
  targetId: string,
): Promise<{ found: boolean; ownerId: string | null }> {
  if (targetType === ModerationTargetType.LISTING) {
    const listing = await db.listing.findUnique({
      where: { id: targetId },
      select: { sellerId: true },
    });
    return { found: Boolean(listing), ownerId: listing?.sellerId ?? null };
  }

  const message = await db.message.findUnique({
    where: { id: targetId },
    select: { senderId: true },
  });
  return { found: Boolean(message), ownerId: message?.senderId ?? null };
}

export async function createReport(
  reporterId: string,
  targetType: ReportableTargetType,
  targetId: string,
  reason: ReportReason,
  detail: string | null,
): Promise<ActionResult> {
  const { found, ownerId } = await ownerOf(targetType, targetId);
  // The same message for "no such thing" and "that's yours", so this cannot be
  // used to discover which ids exist.
  if (!found) return actionFailed("That can't be reported.");
  if (!canReport(reporterId, ownerId)) {
    return actionFailed("You can't report your own listing or message.");
  }

  try {
    await db.report.create({
      data: { reporterId, targetType, targetId, reason, detail },
    });
  } catch (error) {
    // The unique constraint on (reporter, target) firing is not an error from
    // the reporter's point of view — they already told us. Saying so is
    // friendlier than a failure, and truthful.
    if (isUniqueViolation(error)) {
      return actionFailed("You've already reported this. It's in the queue.");
    }
    throw error;
  }

  return actionOk();
}

/** How many reports are waiting, for the badge on the admin nav. */
export async function openReportCount(): Promise<number> {
  return db.report.count({ where: { status: ReportStatus.OPEN } });
}

/** The triage queue. Open first, oldest first — the opposite of the audit log. */
export async function listReports(status: ReportStatus = ReportStatus.OPEN) {
  return db.report.findMany({
    where: { status },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      targetType: true,
      targetId: true,
      reason: true,
      detail: true,
      status: true,
      createdAt: true,
      reporter: { select: { id: true, name: true } },
    },
  });
}

/**
 * A report, plus enough about its target to triage it — but **not** message
 * content.
 *
 * A listing is public, so its title and seller come back freely. A message is
 * private, so this returns only who sent it and when. Reading what it says is
 * a separate, deliberate, logged act: see `revealReportedMessage`.
 */
export async function reportForReview(reportId: string) {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      targetType: true,
      targetId: true,
      reason: true,
      detail: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      resolutionNote: true,
      reporter: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
    },
  });
  if (!report) return null;

  if (report.targetType === ModerationTargetType.LISTING) {
    const listing = await db.listing.findUnique({
      where: { id: report.targetId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        seller: { select: { id: true, name: true, suspendedAt: true } },
      },
    });
    return { report, listing, message: null as null };
  }

  const message = await db.message.findUnique({
    where: { id: report.targetId },
    select: {
      id: true,
      createdAt: true,
      // Deliberately no `body`. Content requires the logged read below.
      sender: { select: { id: true, name: true, suspendedAt: true } },
    },
  });
  return { report, listing: null, message };
}

/**
 * Reveals a reported message and a few either side, and records that it
 * happened.
 *
 * The log row is written **before** the content is fetched. If the read then
 * fails, an unnecessary entry is left behind — which is the right way round:
 * over-logging costs a row, under-logging costs the property the whole feature
 * rests on. It is not wrapped in a transaction for the same reason. A rollback
 * would erase the record of an attempt that may well have succeeded in
 * returning data.
 */
export async function revealReportedMessage(admin: Actor, messageId: string) {
  if (!canModerateContent(admin as ActorLike)) return null;

  const target = await db.message.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true, createdAt: true, senderId: true },
  });
  if (!target) return null;

  await db.moderationLog.create({
    data: {
      action: ModerationAction.MESSAGE_VIEWED,
      adminId: admin.id,
      targetType: ModerationTargetType.MESSAGE,
      targetId: target.id,
      subjectId: target.senderId,
      reason: "Viewed in response to a report",
    },
  });

  const { before, after } = messageContextWindow();

  const select = {
    id: true,
    body: true,
    createdAt: true,
    sender: { select: { id: true, name: true } },
  } as const;

  // Two bounded queries rather than one unbounded fetch: the messages outside
  // the window are never read out of the database at all.
  const [preceding, following] = await Promise.all([
    db.message.findMany({
      where: {
        conversationId: target.conversationId,
        createdAt: { lt: target.createdAt },
      },
      orderBy: { createdAt: "desc" },
      take: before,
      select,
    }),
    db.message.findMany({
      where: {
        conversationId: target.conversationId,
        createdAt: { gt: target.createdAt },
      },
      orderBy: { createdAt: "asc" },
      take: after,
      select,
    }),
  ]);

  const reported = await db.message.findUnique({
    where: { id: target.id },
    select,
  });
  if (!reported) return null;

  return {
    reportedId: target.id,
    messages: [...preceding.reverse(), reported, ...following],
  };
}

/**
 * Closes a report.
 *
 * Dismissal writes an audit-log row in the same transaction, so deciding to do
 * *nothing* is as reviewable as deciding to act — the decision an
 * unaccountable moderator is most likely to make badly is the one nobody
 * records. Marking a report actioned does not log separately, because the
 * action it refers to has already written its own entry.
 */
export async function resolveReport(
  admin: Actor,
  reportId: string,
  status: typeof ReportStatus.ACTIONED | typeof ReportStatus.DISMISSED,
  note: string,
): Promise<ActionResult> {
  if (!canModerateContent(admin as ActorLike)) {
    return actionFailed("You can't take that action.");
  }

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.report.updateMany({
        where: { id: reportId, status: ReportStatus.OPEN },
        data: {
          status,
          resolvedAt: new Date(),
          resolvedById: admin.id,
          resolutionNote: note,
        },
      });
      if (updated.count === 0) {
        throw new NoChange("That report doesn't exist, or is already closed.");
      }

      if (status === ReportStatus.DISMISSED) {
        await tx.moderationLog.create({
          data: {
            action: ModerationAction.REPORT_DISMISSED,
            adminId: admin.id,
            targetType: ModerationTargetType.REPORT,
            targetId: reportId,
            reason: note,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof NoChange) return actionFailed(error.message);
    throw error;
  }

  return actionOk();
}

/** Prisma's unique-constraint code, without importing the error class. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

class NoChange extends Error {}
