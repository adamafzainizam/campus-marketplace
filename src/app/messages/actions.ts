"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { publish } from "@/lib/ably";
import { getParticipantsIfMember } from "@/lib/conversations";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  actionFailed,
  actionOk,
  type ActionResult,
} from "@/lib/action-result";
import {
  conversationChannel,
  counterpartyId,
  isSafeChannelId,
  userChannel,
  validateMessageBody,
} from "@/lib/message-constraints";
import { validateId } from "@/lib/listing-constraints";

/**
 * Server actions for messaging.
 *
 * Each one is a public POST endpoint, so each independently authenticates,
 * authorizes, rate limits, and validates. None of them trusts that the caller
 * came through the UI.
 */

/**
 * Returns the caller's id, or null when signed out. Callers turn that into an
 * ActionFailure — thrown errors are masked in production builds, so an
 * expected "you're signed out" would reach the user as an opaque digest.
 */
async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Opens (or returns) the thread between the current user and a listing's
 * seller. Idempotent: the unique constraint on (listingId, buyerId) means a
 * double-click can't create two threads.
 */
export async function startConversation(
  rawListingId: unknown,
): Promise<ActionResult<string>> {
  const userId = await currentUserId();
  if (!userId) return actionFailed("You need to be signed in to message a seller.");

  const listingId = validateId(rawListingId, "Listing");
  if (!listingId.ok) return actionFailed(listingId.error);

  const limit = await consumeRateLimit("conversation", userId);
  if (!limit.allowed) {
    return actionFailed(
      `Too many conversations started. Try again in ${limit.retryAfter} seconds.`,
    );
  }

  const listing = await db.listing.findUnique({
    where: { id: listingId.value },
    select: { id: true, sellerId: true },
  });
  if (!listing) {
    return actionFailed("That listing no longer exists.");
  }
  if (listing.sellerId === userId) {
    return actionFailed("You can't start a conversation on your own listing.");
  }

  const conversation = await db.conversation.upsert({
    where: {
      listingId_buyerId: { listingId: listing.id, buyerId: userId },
    },
    create: { listingId: listing.id, buyerId: userId },
    update: {},
    select: { id: true },
  });

  return actionOk(conversation.id);
}

export async function sendMessage(
  rawConversationId: unknown,
  rawBody: unknown,
): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return actionFailed("You need to be signed in to send a message.");

  const conversationId = validateId(rawConversationId, "Conversation");
  if (!conversationId.ok) return actionFailed(conversationId.error);

  const body = validateMessageBody(rawBody);
  if (!body.ok) return actionFailed(body.error);

  const limit = await consumeRateLimit("message", userId);
  if (!limit.allowed) {
    return actionFailed(
      `You're sending messages too quickly. Try again in ${limit.retryAfter} seconds.`,
    );
  }

  // Authorization before any write. Returns null for both "doesn't exist" and
  // "not yours", so this reveals nothing about other people's conversations.
  const participants = await getParticipantsIfMember(
    conversationId.value,
    userId,
  );
  if (!participants) {
    return actionFailed("Conversation not found.");
  }

  const message = await db.message.create({
    data: {
      conversationId: participants.conversationId,
      senderId: userId,
      body: body.value,
    },
    select: { id: true, body: true, createdAt: true, senderId: true },
  });

  // Bump for inbox ordering.
  await db.conversation.update({
    where: { id: participants.conversationId },
    data: { updatedAt: new Date() },
    select: { id: true },
  });

  // Published only after the row exists, so the database stays the source of
  // truth. Ably's free tier keeps messages for 1 day, so it can never be the
  // store of record — it is live fan-out only.
  await publish(conversationChannel(participants.conversationId), "message", {
    id: message.id,
    body: message.body,
    senderId: message.senderId,
    createdAt: message.createdAt.toISOString(),
  });

  // Nudge the other party's personal channel so their inbox badge updates
  // without them having the thread open.
  const otherUserId = counterpartyId(participants, userId);
  if (isSafeChannelId(otherUserId)) {
    await publish(userChannel(otherUserId), "conversation-activity", {
      conversationId: participants.conversationId,
    });
  }

  revalidatePath("/messages");

  return actionOk();
}

export async function markRead(
  rawConversationId: unknown,
): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return actionFailed("You need to be signed in.");

  const conversationId = validateId(rawConversationId, "Conversation");
  if (!conversationId.ok) return actionFailed(conversationId.error);

  const participants = await getParticipantsIfMember(
    conversationId.value,
    userId,
  );
  if (!participants) {
    return actionFailed("Conversation not found.");
  }

  await db.conversationRead.upsert({
    where: {
      conversationId_userId: {
        conversationId: participants.conversationId,
        userId,
      },
    },
    create: { conversationId: participants.conversationId, userId },
    update: { lastReadAt: new Date() },
    select: { conversationId: true },
  });

  return actionOk();
}
