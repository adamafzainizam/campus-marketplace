import { after, before, describe, mock, test } from "node:test";
import assert from "node:assert/strict";

import {
  createConversationWorld,
  type ConversationWorld,
} from "@/lib/db-test-support";

/**
 * Tests for the capability-scoping route the messaging security model rests on.
 *
 * Only `@/auth` is faked. The database is real, `getParticipantsIfMember` is
 * real, and the Ably client is real — `createTokenRequest` signs locally with
 * HMAC and does not contact Ably unless `queryTime` is set, which it is not, so
 * this suite consumes no free-tier quota and cannot fail on network.
 *
 * The mock is installed **once**, at module scope, reading a mutable `session`.
 * A `t.mock.module` inside each test looks equivalent and is not: ESM imports
 * the route module once and it closes over whichever mock was active then, so
 * later tests silently receive the first test's session. That was observed
 * before this suite was written, not guessed at.
 */

let session: unknown = null;

// `exports` is the current runtime option. `@types/node` still declares only
// the older `namedExports`, which Node now prints a DeprecationWarning for, so
// the option is cast rather than written against the deprecated path. If Node
// ever drops `exports`, this fails loudly at runtime, which is the right way
// round.
mock.module("@/auth", {
  exports: { auth: async () => session },
} as unknown as Parameters<typeof mock.module>[1]);

const { GET } = await import("@/app/api/ably/token/route");

let world: ConversationWorld;

before(async () => {
  world = await createConversationWorld();
});

after(async () => {
  await world?.cleanup();
});

function request(query = ""): Request {
  return new Request(`http://localhost/api/ably/token${query}`);
}

/** Every capability this suite has seen, so the publish check covers them all. */
const observedCapabilities: Record<string, string[]>[] = [];

/**
 * Ably canonicalises a capability, returning operations in alphabetical order
 * rather than the order the route passed them in — so a token asked for
 * `["subscribe", "presence"]` comes back as `["presence", "subscribe"]`.
 * The order carries no meaning and is not a security property; the set of
 * operations is. Comparing sorted copies asserts the part that matters without
 * pinning behaviour Ably is free to change.
 */
function assertGrants(actual: string[] | undefined, expected: string[]): void {
  assert.deepEqual([...(actual ?? [])].sort(), [...expected].sort());
}

async function tokenFor(query = ""): Promise<{
  status: number;
  body: Record<string, unknown>;
  headers: Headers;
}> {
  const response = await GET(request(query));
  const body = (await response.json()) as Record<string, unknown>;

  if (typeof body.capability === "string") {
    observedCapabilities.push(
      JSON.parse(body.capability) as Record<string, string[]>,
    );
  }

  return { status: response.status, body, headers: response.headers };
}

describe("rejection", () => {
  test("answers 401 when there is no session", async () => {
    session = null;

    const { status } = await tokenFor();

    assert.equal(status, 401);
  });

  test("answers 401 when the session carries no user id", async () => {
    session = { user: { name: "Nameless" } };

    const { status } = await tokenFor();

    assert.equal(status, 401);
  });

  test("answers 400 when the session id is not a safe channel id", async () => {
    // A session id is not user input in normal operation, but the route checks
    // it anyway before interpolating it into a channel name, and so does this.
    session = { user: { id: "not*a*safe*id" } };

    const { status } = await tokenFor();

    assert.equal(status, 400);
  });

  test("answers 400 to a wildcard conversation id", async () => {
    // The attack this guard exists to stop: Ably capabilities are channel-name
    // patterns in which `*` is a wildcard, so an unchecked id could widen the
    // capability the token grants.
    session = { user: { id: world.buyerId } };

    const { status } = await tokenFor("?conversationId=*");

    assert.equal(status, 400);
  });

  test("answers 400 to a conversation id containing a colon", async () => {
    session = { user: { id: world.buyerId } };

    const { status } = await tokenFor("?conversationId=a:b");

    assert.equal(status, 400);
  });

  test("answers 404 for a conversation the caller does not participate in", async () => {
    session = { user: { id: world.strangerId } };

    const { status } = await tokenFor(
      `?conversationId=${world.conversationId}`,
    );

    assert.equal(status, 404);
  });

  test("a stranger cannot distinguish 'not yours' from 'does not exist'", async () => {
    session = { user: { id: world.strangerId } };

    const notMine = await tokenFor(`?conversationId=${world.conversationId}`);
    const missing = await tokenFor(
      "?conversationId=clnonexistentconversation01",
    );

    assert.equal(notMine.status, missing.status);
    assert.deepEqual(notMine.body, missing.body);
  });
});

describe("capability", () => {
  test("grants only the caller's own channel, subscribe only, with no conversation", async () => {
    session = { user: { id: world.buyerId } };

    const { status, body } = await tokenFor();
    const capability = JSON.parse(body.capability as string);

    assert.equal(status, 200);
    assert.deepEqual(Object.keys(capability), [`user:${world.buyerId}`]);
    assertGrants(capability[`user:${world.buyerId}`], ["subscribe"]);
  });

  test("grants subscribe and presence on a conversation the caller is in", async () => {
    session = { user: { id: world.buyerId } };

    const { status, body } = await tokenFor(
      `?conversationId=${world.conversationId}`,
    );
    const capability = JSON.parse(body.capability as string);

    assert.equal(status, 200);
    assertGrants(capability[`conversation:${world.conversationId}`], [
      "subscribe",
      "presence",
    ]);
  });

  test("grants the seller the same access as the buyer", async () => {
    session = { user: { id: world.sellerId } };

    const { status, body } = await tokenFor(
      `?conversationId=${world.conversationId}`,
    );
    const capability = JSON.parse(body.capability as string);

    assert.equal(status, 200);
    assertGrants(capability[`conversation:${world.conversationId}`], [
      "subscribe",
      "presence",
    ]);
  });

  test("binds clientId to the session user, not to anything the caller chooses", async () => {
    session = { user: { id: world.buyerId } };

    const { body } = await tokenFor();

    assert.equal(body.clientId, world.buyerId);
  });

  test("forbids caching, so a token cannot be shared by a proxy", async () => {
    session = { user: { id: world.buyerId } };

    const { headers } = await tokenFor();

    assert.equal(headers.get("Cache-Control"), "no-store");
  });

  test("never grants publish, on any channel, in any response so far", async () => {
    // The property the whole design rests on: messages enter a channel only
    // from the server after a verified write, so a stolen token cannot forge
    // one — the ability is not in it. Scans every capability this suite has
    // produced rather than one response, so it keeps holding for capabilities
    // added later.
    assert.ok(
      observedCapabilities.length >= 4,
      "expected several capabilities to have been observed",
    );

    for (const capability of observedCapabilities) {
      for (const [channel, operations] of Object.entries(capability)) {
        assert.ok(
          !operations.includes("publish"),
          `token granted publish on ${channel}`,
        );
      }
    }
  });
});
