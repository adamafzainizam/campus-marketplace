import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

import { getParticipantsIfMember, listInboxFor } from "@/lib/conversations";
import {
  addMessage,
  addSecondConversation,
  createConversationWorld,
  markRead,
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

describe("listInboxFor", () => {
  test("returns the conversation to both participants and not to a stranger", async () => {
    const forBuyer = await listInboxFor(world.buyerId);
    const forSeller = await listInboxFor(world.sellerId);
    const forStranger = await listInboxFor(world.strangerId);

    assert.equal(
      forBuyer.some((entry) => entry.id === world.conversationId),
      true,
    );
    assert.equal(
      forSeller.some((entry) => entry.id === world.conversationId),
      true,
    );
    assert.deepEqual(forStranger, []);
  });

  test("names the counterparty from each viewer's perspective", async () => {
    const forBuyer = (await listInboxFor(world.buyerId)).find(
      (entry) => entry.id === world.conversationId,
    );
    const forSeller = (await listInboxFor(world.sellerId)).find(
      (entry) => entry.id === world.conversationId,
    );

    assert.equal(forBuyer?.counterpartyName, "Test Seller");
    assert.equal(forSeller?.counterpartyName, "Test Buyer");
  });

  test("marks a conversation unread when the viewer has never read it", async () => {
    await addMessage(world.conversationId, world.sellerId, "Still available?");

    const entry = (await listInboxFor(world.buyerId)).find(
      (candidate) => candidate.id === world.conversationId,
    );

    assert.equal(entry?.unread, true);
    assert.equal(entry?.lastMessage, "Still available?");
  });

  test("marks it read once lastReadAt is newer than the last message", async () => {
    await markRead(
      world.conversationId,
      world.buyerId,
      new Date(Date.now() + 60_000),
    );

    const entry = (await listInboxFor(world.buyerId)).find(
      (candidate) => candidate.id === world.conversationId,
    );

    assert.equal(entry?.unread, false);
  });

  test("orders conversations by most recent activity first", async () => {
    const newerId = await addSecondConversation(
      world,
      new Date(Date.now() + 120_000),
    );

    const inbox = await listInboxFor(world.buyerId);
    const ids = inbox.map((entry) => entry.id);

    assert.equal(ids[0], newerId);
    assert.ok(ids.indexOf(newerId) < ids.indexOf(world.conversationId));
  });
});
