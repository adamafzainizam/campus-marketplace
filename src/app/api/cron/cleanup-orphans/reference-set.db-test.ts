import { after, before, test } from "node:test";
import assert from "node:assert/strict";

import { db } from "@/lib/db";
import {
  createConversationWorld,
  type ConversationWorld,
} from "@/lib/db-test-support";

/**
 * The cleanup job deletes every R2 object no listing references. It is the
 * only thing in this codebase that destroys data on a schedule, so what counts
 * as "referenced" is the property worth pinning.
 *
 * This restates the route's query rather than importing the route: the handler
 * needs a Request and the cron secret, and what matters here is the *shape* of
 * the reference set. If the route drifts from this, the mutation test recorded
 * in the PR is what catches it — noted honestly as a limit of this test.
 */

let world: ConversationWorld;

before(async () => {
  world = await createConversationWorld();
});

after(async () => {
  await world?.cleanup();
});

test("the reference set protects every photo, not just the cover", async () => {
  const keys = [
    `listings/${world.sellerId}/aaaaaaaa-0000-4000-8000-000000000000.jpg`,
    `listings/${world.sellerId}/bbbbbbbb-0000-4000-8000-000000000000.jpg`,
    `listings/${world.sellerId}/cccccccc-0000-4000-8000-000000000000.jpg`,
  ];

  await db.listing.update({
    where: { id: world.listingId },
    data: { imageKeys: keys },
  });

  const listings = await db.listing.findMany({
    where: { imageKeys: { isEmpty: false } },
    select: { imageKeys: true },
  });
  const referenced = new Set(listings.flatMap((listing) => listing.imageKeys));

  for (const key of keys) {
    assert.ok(referenced.has(key), `${key} was not protected from deletion`);
  }
});

test("a listing with no photos contributes nothing to the set", async () => {
  await db.listing.update({
    where: { id: world.listingId },
    data: { imageKeys: [] },
  });

  const listings = await db.listing.findMany({
    where: { imageKeys: { isEmpty: false } },
    select: { imageKeys: true },
  });

  assert.ok(
    listings.every((listing) => listing.imageKeys.length > 0),
    "the isEmpty:false filter let an empty array through",
  );
});
