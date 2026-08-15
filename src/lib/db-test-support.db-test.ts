import { test } from "node:test";
import assert from "node:assert/strict";

import { db } from "@/lib/db";
import { createConversationWorld } from "@/lib/db-test-support";

test("createConversationWorld builds a world and cleanup removes all of it", async () => {
  const world = await createConversationWorld();

  const conversation = await db.conversation.findUnique({
    where: { id: world.conversationId },
    select: { buyerId: true, listing: { select: { sellerId: true } } },
  });

  assert.notEqual(conversation, null);
  assert.equal(conversation?.buyerId, world.buyerId);
  assert.equal(conversation?.listing.sellerId, world.sellerId);
  assert.notEqual(world.strangerId, world.buyerId);
  assert.notEqual(world.strangerId, world.sellerId);

  await world.cleanup();

  assert.equal(
    await db.conversation.findUnique({ where: { id: world.conversationId } }),
    null,
  );
  assert.equal(
    await db.listing.findUnique({ where: { id: world.listingId } }),
    null,
  );
  assert.equal(
    await db.category.findUnique({ where: { id: world.categoryId } }),
    null,
  );
  assert.equal(
    await db.user.count({
      where: { id: { in: [world.sellerId, world.buyerId, world.strangerId] } },
    }),
    0,
  );
});
