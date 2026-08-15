"use server";

import { revalidatePath } from "next/cache";
import {
  currentAdmin,
  reinstateUser,
  removeListing,
  suspendUser,
} from "@/lib/moderation";
import { resolveReport, revealReportedMessage } from "@/lib/reports";
import { validateModerationReason } from "@/lib/moderation-rules";
import { validateId } from "@/lib/listing-constraints";
import { ReportStatus } from "@/generated/prisma/enums";
import { actionFailed, actionOk, type ActionResult } from "@/lib/action-result";

/**
 * Moderation actions.
 *
 * Every one of these is a public POST endpoint. Rendering the admin pages
 * behind a role check is not a security boundary — the request can be sent
 * without the UI existing at all — so each action re-establishes who the
 * caller is from the database rather than trusting that they got here somehow.
 *
 * Failures are returned, not thrown: Next.js masks thrown errors in production
 * builds (Known Gotchas #35).
 *
 * The same message, "You can't take that action", covers both "you are not an
 * administrator" and "that target is not valid for you". Distinguishing them
 * would let an ordinary user probe for which ids exist.
 */

const NOT_ALLOWED = "You can't take that action.";

export async function suspendUserAction(
  rawUserId: unknown,
  rawReason: unknown,
): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return actionFailed(NOT_ALLOWED);

  const userId = validateId(rawUserId, "User");
  if (!userId.ok) return actionFailed(userId.error);

  const reason = validateModerationReason(rawReason);
  if (!reason.ok) return actionFailed(reason.error);

  const result = await suspendUser(admin, userId.value, reason.value);
  if (!result.ok) return result;

  // Their listings drop off the board the moment the suspension lands.
  revalidatePath("/");
  revalidatePath("/admin");
  return result;
}

export async function reinstateUserAction(
  rawUserId: unknown,
  rawReason: unknown,
): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return actionFailed(NOT_ALLOWED);

  const userId = validateId(rawUserId, "User");
  if (!userId.ok) return actionFailed(userId.error);

  // A reason is required to reverse an action too. A reinstatement with no
  // stated basis is exactly as unreviewable as a suspension with none.
  const reason = validateModerationReason(rawReason);
  if (!reason.ok) return actionFailed(reason.error);

  const result = await reinstateUser(admin, userId.value, reason.value);
  if (!result.ok) return result;

  revalidatePath("/");
  revalidatePath("/admin");
  return result;
}

/**
 * Closes a report as actioned or dismissed.
 *
 * A note is required either way, and validated with the same rule as any other
 * moderation reason — a dismissal with no stated basis is exactly as
 * unreviewable as a suspension with none.
 */
export async function resolveReportAction(
  rawReportId: unknown,
  rawStatus: unknown,
  rawNote: unknown,
): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return actionFailed(NOT_ALLOWED);

  const reportId = validateId(rawReportId, "Report");
  if (!reportId.ok) return actionFailed(reportId.error);

  if (rawStatus !== ReportStatus.ACTIONED && rawStatus !== ReportStatus.DISMISSED) {
    return actionFailed("That isn't a valid outcome for a report.");
  }

  const note = validateModerationReason(rawNote);
  if (!note.ok) return actionFailed(note.error);

  const result = await resolveReport(admin, reportId.value, rawStatus, note.value);
  if (!result.ok) return result;

  revalidatePath("/admin/reports");
  revalidatePath(`/admin/reports/${reportId.value}`);
  return result;
}

/**
 * Reveals a reported message and a little of what surrounds it.
 *
 * This is the only privileged read in the application, and calling it writes
 * an audit-log entry before any content comes back. It is an action rather
 * than page data on purpose: reading somebody's message should be something a
 * moderator chooses to do, not something that happens by opening a page.
 */
export async function revealReportedMessageAction(
  rawMessageId: unknown,
): Promise<ActionResult<RevealedMessages>> {
  const admin = await currentAdmin();
  if (!admin) return actionFailed(NOT_ALLOWED);

  const messageId = validateId(rawMessageId, "Message");
  if (!messageId.ok) return actionFailed(messageId.error);

  const revealed = await revealReportedMessage(admin, messageId.value);
  if (!revealed) return actionFailed("That message no longer exists.");

  return actionOk({
    reportedId: revealed.reportedId,
    messages: revealed.messages.map((message) => ({
      id: message.id,
      body: message.body,
      senderName: message.sender.name,
      createdAt: message.createdAt.toISOString(),
    })),
  });
}

export type RevealedMessages = {
  reportedId: string;
  messages: Array<{
    id: string;
    body: string;
    senderName: string;
    createdAt: string;
  }>;
};

export async function removeListingAction(
  rawListingId: unknown,
  rawReason: unknown,
): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return actionFailed(NOT_ALLOWED);

  const listingId = validateId(rawListingId, "Listing");
  if (!listingId.ok) return actionFailed(listingId.error);

  const reason = validateModerationReason(rawReason);
  if (!reason.ok) return actionFailed(reason.error);

  const result = await removeListing(admin, listingId.value, reason.value);
  if (!result.ok) return result;

  revalidatePath("/");
  revalidatePath(`/listings/${listingId.value}`);
  revalidatePath("/admin");
  return result;
}
