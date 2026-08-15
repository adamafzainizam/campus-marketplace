/**
 * Fixtures for the database-backed test suites (`*.db-test.ts`).
 *
 * Not `server-only`: this is deliberately importable by the harness. It is
 * never imported by a route, so Next does not bundle it — the same reasoning
 * that lets `.test.ts` files sit beside the modules they test.
 *
 * Every row is created behind a `randomUUID()` prefix so that repeated or
 * concurrent runs cannot collide on unique columns (`User.email`,
 * `Category.name`, `Category.slug`).
 */

import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";

export type ConversationWorld = {
  prefix: string;
  sellerId: string;
  buyerId: string;
  /** Signed in, participates in nothing, and must therefore see nothing. */
  strangerId: string;
  categoryId: string;
  listingId: string;
  conversationId: string;
  cleanup: () => Promise<void>;
};

export async function createConversationWorld(): Promise<ConversationWorld> {
  const prefix = `dbtest_${randomUUID().replace(/-/g, "")}`;

  const [seller, buyer, stranger] = await Promise.all([
    db.user.create({
      data: { email: `${prefix}.seller@test.invalid`, name: "Test Seller" },
    }),
    db.user.create({
      data: { email: `${prefix}.buyer@test.invalid`, name: "Test Buyer" },
    }),
    db.user.create({
      data: { email: `${prefix}.stranger@test.invalid`, name: "Test Stranger" },
    }),
  ]);

  const category = await db.category.create({
    data: { name: `${prefix} Category`, slug: `${prefix}-category` },
  });

  const listing = await db.listing.create({
    data: {
      title: "Test listing",
      description: "Created by the database test suite.",
      price: "10.00",
      condition: "GOOD",
      sellerId: seller.id,
      categoryId: category.id,
    },
  });

  const conversation = await db.conversation.create({
    data: { listingId: listing.id, buyerId: buyer.id },
  });

  /**
   * Teardown, in the order the schema forces. `Listing`'s relations are
   * `onDelete: Restrict` by deliberate choice, so nothing cascades from the
   * top and every level has to go explicitly. Messages and reads *do* cascade
   * from `Conversation`, so deleting conversations is enough for those.
   *
   * Scoped by `categoryId` rather than by the ids captured here, so that any
   * extra listing or conversation a test creates in this world is cleaned up
   * too without the test having to register it.
   */
  async function cleanup(): Promise<void> {
    await db.conversation.deleteMany({
      where: { listing: { categoryId: category.id } },
    });
    await db.listing.deleteMany({ where: { categoryId: category.id } });
    await db.category.deleteMany({ where: { id: category.id } });
    await db.user.deleteMany({
      where: { id: { in: [seller.id, buyer.id, stranger.id] } },
    });
  }

  return {
    prefix,
    sellerId: seller.id,
    buyerId: buyer.id,
    strangerId: stranger.id,
    categoryId: category.id,
    listingId: listing.id,
    conversationId: conversation.id,
    cleanup,
  };
}

export async function addMessage(
  conversationId: string,
  senderId: string,
  body: string,
  createdAt?: Date,
): Promise<{ id: string; createdAt: Date }> {
  return db.message.create({
    data: {
      conversationId,
      senderId,
      body,
      ...(createdAt ? { createdAt } : {}),
    },
    select: { id: true, createdAt: true },
  });
}

export async function markRead(
  conversationId: string,
  userId: string,
  lastReadAt: Date,
): Promise<void> {
  await db.conversationRead.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    create: { conversationId, userId, lastReadAt },
    update: { lastReadAt },
  });
}

/**
 * A second listing and conversation in the same world, with an explicit
 * `updatedAt` so inbox ordering can be asserted deterministically rather than
 * relying on two `now()` values landing in a predictable order.
 */
export async function addSecondConversation(
  world: ConversationWorld,
  updatedAt: Date,
): Promise<string> {
  const listing = await db.listing.create({
    data: {
      title: "Second test listing",
      description: "Created by the database test suite.",
      price: "20.00",
      condition: "GOOD",
      sellerId: world.sellerId,
      categoryId: world.categoryId,
    },
  });

  const conversation = await db.conversation.create({
    data: { listingId: listing.id, buyerId: world.buyerId, updatedAt },
  });

  return conversation.id;
}

export async function suspend(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { suspendedAt: new Date(), suspendedReason: "Database test fixture." },
  });
}
