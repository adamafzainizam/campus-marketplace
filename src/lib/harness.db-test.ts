import { test } from "node:test";
import assert from "node:assert/strict";

test("the harness can import a server-only module through the @/ alias", async () => {
  const conversations = await import("@/lib/conversations");

  assert.equal(typeof conversations.getParticipantsIfMember, "function");
  assert.equal(typeof conversations.listInboxFor, "function");
  assert.equal(typeof conversations.getThreadFor, "function");
});

test("the harness points the Prisma client at the test database", () => {
  assert.equal(process.env.DATABASE_URL, process.env.TEST_DATABASE_URL);
  assert.notEqual(process.env.TEST_DATABASE_URL, undefined);
});
