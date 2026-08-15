"use server";

import { auth } from "@/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createReport } from "@/lib/reports";
import {
  validateReportDetail,
  validateReportReason,
  validateReportTarget,
} from "@/lib/report-rules";
import { validateId } from "@/lib/listing-constraints";
import { actionFailed, type ActionResult } from "@/lib/action-result";

/**
 * Raising a report.
 *
 * A directory with actions and no `page.tsx`, so it defines no route — this is
 * called from the listing page and from a conversation, both of which live
 * elsewhere.
 *
 * Note what is deliberately *not* checked: whether the reporter is suspended.
 * A suspended user may still report things. Suspension exists to stop someone
 * harming others, and reporting harms nobody — silencing a suspended person's
 * ability to flag a scam would punish everyone else for their behaviour.
 */
export async function reportContent(
  rawTargetType: unknown,
  rawTargetId: unknown,
  rawReason: unknown,
  rawDetail: unknown,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return actionFailed("You need to be signed in to report something.");
  }
  const userId = session.user.id;

  const targetType = validateReportTarget(rawTargetType);
  if (!targetType.ok) return actionFailed(targetType.error);

  const targetId = validateId(rawTargetId, "Report target");
  if (!targetId.ok) return actionFailed(targetId.error);

  const reason = validateReportReason(rawReason);
  if (!reason.ok) return actionFailed(reason.error);

  const detail = validateReportDetail(rawDetail);
  if (!detail.ok) return actionFailed(detail.error);

  // The scarce resource here is not storage but the moderator's queue: one
  // person filing continuously would bury genuine reports under noise.
  const limit = await consumeRateLimit("report", userId);
  if (!limit.allowed) {
    return actionFailed(
      `You've reported a lot recently. Try again in ${limit.retryAfter} seconds, or email us if it's urgent.`,
    );
  }

  return createReport(
    userId,
    targetType.value,
    targetId.value,
    reason.value,
    detail.value,
  );
}
