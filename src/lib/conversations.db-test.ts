import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

import { getParticipantsIfMember } from "@/lib/conversations";
import {
  createConversationWorld,
  type ConversationWorld,
} from "@/lib/db-test-support";

let world: ConversationWorld;

before(async () => {
  world = await createConversationWorld();
});

// Runs even when an assertion above it fails, so a red suite still leaves the
// test branch clean.
after(async () => {
  await world?.cleanup();
});

describe("getParticipantsIfMember", () => {
  test("returns the participants to the buyer", async () => {
    const result = await getParticipantsIfMember(
      world.conversationId,
      world.buyerId,
    );

    assert.deepEqual(result, {
      conversationId: world.conversationId,
      listingId: world.listingId,
      buyerId: world.buyerId,
      sellerId: world.sellerId,
    });
  });

  test("returns the same participants to the seller", async () => {
    const result = await getParticipantsIfMember(
      world.conversationId,
      world.sellerId,
    );

    // The seller is derived from listing.sellerId, not stored on the
    // conversation — this is what proves that derivation is wired correctly.
    assert.equal(result?.sellerId, world.sellerId);
    assert.equal(result?.buyerId, world.buyerId);
  });

  test("returns null to a signed-in stranger", async () => {
    const result = await getParticipantsIfMember(
      world.conversationId,
      world.strangerId,
    );

    assert.equal(result, null);
  });

  test("returns null for a conversation that does not exist", async () => {
    const result = await getParticipantsIfMember(
      "clnonexistentconversation01",
      world.buyerId,
    );

    assert.equal(result, null);
  });

  test("a stranger cannot distinguish 'not yours' from 'does not exist'", async () => {
    // The module's own comment claims callers must not be able to tell these
    // apart, because "this conversation exists but isn't yours" is itself
    // information. Nothing held that claim to account until this test.
    const notMine = await getParticipantsIfMember(
      world.conversationId,
      world.strangerId,
    );
    const missing = await getParticipantsIfMember(
      "clnonexistentconversation01",
      world.strangerId,
    );

    assert.deepEqual(notMine, missing);
  });
});
