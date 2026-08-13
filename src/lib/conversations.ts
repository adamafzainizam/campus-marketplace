import "server-only";

import { db } from "@/lib/db";
import { isParticipant } from "@/lib/message-constraints";

/**
 * Data access for conversations.
 *
 * Every read here performs its own authorization check and returns a shaped
 * DTO rather than a raw row. This follows the Data Access Layer pattern Next
 * recommends for new projects: authorization lives next to the query, so a new
 * page can't accidentally render a conversation by forgetting a check, and
 * "constrain return values" is enforced in one place rather than at every call
 * site.
 *
 * User rows in particular are never returned whole — only `id` and `name` are
 * ever selected, so an email address cannot reach a Client Component even by
 * accident.
 */

export type ConversationParticipants = {
  conversationId: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
};

/**
 * The authorization primitive the rest of the messaging feature is built on.
 * Returns null both when the conversation does not exist and when the viewer
 * is not a participant — callers should not be able to distinguish the two,
 * because "this conversation exists but isn't yours" is itself information.
 */
export async function getParticipantsIfMember(
  conversationId: string,
  viewerId: string,
): Promise<ConversationParticipants | null> {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      buyerId: true,
      listingId: true,
      listing: { select: { sellerId: true } },
    },
  });

  if (!conversation) return null;

  const participants: ConversationParticipants = {
    conversationId: conversation.id,
    listingId: conversation.listingId,
    buyerId: conversation.buyerId,
    sellerId: conversation.listing.sellerId,
  };

  return isParticipant(participants, viewerId) ? participants : null;
}

export type InboxEntry = {
  id: string;
  listingTitle: string;
  listingId: string;
  listingImageKey: string | null;
  counterpartyName: string;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  unread: boolean;
};

/**
 * Threads the viewer participates in, most recently active first.
 *
 * "Mine" is `buyerId = me OR listing.sellerId = me`, because the seller is
 * derived from the listing rather than duplicated onto the conversation.
 */
export async function listInboxFor(viewerId: string): Promise<InboxEntry[]> {
  const conversations = await db.conversation.findMany({
    where: {
      OR: [{ buyerId: viewerId }, { listing: { sellerId: viewerId } }],
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      listingId: true,
      buyerId: true,
      listing: {
        select: {
          title: true,
          imageUrl: true,
          sellerId: true,
          seller: { select: { name: true } },
        },
      },
      buyer: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true },
      },
      reads: {
        where: { userId: viewerId },
        select: { lastReadAt: true },
      },
    },
  });

  return conversations.map((conversation) => {
    const viewerIsBuyer = conversation.buyerId === viewerId;
    const latest = conversation.messages[0] ?? null;
    const lastReadAt = conversation.reads[0]?.lastReadAt ?? null;

    return {
      id: conversation.id,
      listingId: conversation.listingId,
      listingTitle: conversation.listing.title,
      listingImageKey: conversation.listing.imageUrl,
      counterpartyName: viewerIsBuyer
        ? conversation.listing.seller.name
        : conversation.buyer.name,
      lastMessage: latest?.body ?? null,
      lastMessageAt: latest?.createdAt ?? null,
      unread:
        latest !== null &&
        (lastReadAt === null || latest.createdAt > lastReadAt),
    };
  });
}

export type ThreadMessage = {
  id: string;
  body: string;
  createdAt: Date;
  senderId: string;
};

export type Thread = {
  id: string;
  listingId: string;
  listingTitle: string;
  counterpartyId: string;
  counterpartyName: string;
  messages: ThreadMessage[];
};

/** Returns null if the conversation doesn't exist or isn't the viewer's. */
export async function getThreadFor(
  conversationId: string,
  viewerId: string,
): Promise<Thread | null> {
  const participants = await getParticipantsIfMember(conversationId, viewerId);
  if (!participants) return null;

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      listingId: true,
      buyerId: true,
      listing: {
        select: { title: true, seller: { select: { id: true, name: true } } },
      },
      buyer: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
        select: { id: true, body: true, createdAt: true, senderId: true },
      },
    },
  });

  if (!conversation) return null;

  const viewerIsBuyer = conversation.buyerId === viewerId;
  const counterparty = viewerIsBuyer
    ? conversation.listing.seller
    : conversation.buyer;

  return {
    id: conversation.id,
    listingId: conversation.listingId,
    listingTitle: conversation.listing.title,
    counterpartyId: counterparty.id,
    counterpartyName: counterparty.name,
    messages: conversation.messages,
  };
}
