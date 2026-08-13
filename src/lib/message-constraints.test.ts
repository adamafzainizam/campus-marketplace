/**
 * Tests for messaging rules and Ably channel naming.
 *
 * The channel-id tests are security tests, not formatting tests: Ably
 * capabilities are channel-name patterns in which `*` is a wildcard, so an id
 * that escapes its expected shape can widen what a token is allowed to do.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MESSAGE_MAX_LENGTH,
  conversationChannel,
  counterpartyId,
  isParticipant,
  isSafeChannelId,
  userChannel,
  validateMessageBody,
} from "./message-constraints.ts";

const NON_STRINGS = [null, undefined, 42, 0, true, false, {}, [], ["x"]];

describe("validateMessageBody", () => {
  it("accepts a normal message and trims it", () => {
    const result = validateMessageBody("  Is this still available?  ");
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, "Is this still available?");
  });

  it("rejects non-string input without throwing", () => {
    for (const value of NON_STRINGS) {
      assert.doesNotThrow(() => validateMessageBody(value));
      assert.equal(validateMessageBody(value).ok, false);
    }
  });

  it("rejects empty and whitespace-only bodies", () => {
    assert.equal(validateMessageBody("").ok, false);
    assert.equal(validateMessageBody("   ").ok, false);
    assert.equal(validateMessageBody("\n\t  \n").ok, false);
  });

  it("enforces the length cap at the boundary", () => {
    assert.equal(validateMessageBody("x".repeat(MESSAGE_MAX_LENGTH)).ok, true);
    assert.equal(validateMessageBody("x".repeat(MESSAGE_MAX_LENGTH + 1)).ok, false);
  });

  // Bodies are rendered as text through JSX, so React escapes them. This test
  // pins the intent: markup is preserved verbatim rather than stripped,
  // because stripping would imply the output is trusted somewhere.
  it("preserves markup verbatim rather than sanitising it", () => {
    const hostile = "<script>alert(1)</script>";
    const result = validateMessageBody(hostile);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, hostile);
  });
});

describe("isSafeChannelId", () => {
  it("accepts cuid-shaped ids", () => {
    assert.equal(isSafeChannelId("cmsliiije00000a9y6absvagz"), true);
    assert.equal(isSafeChannelId("abc-DEF_123"), true);
  });

  // The security core of channel naming. `*` is Ably's capability wildcard,
  // and `:` is its channel-namespace separator — an id containing either could
  // change which channels a token covers.
  it("rejects ids that could widen an Ably capability", () => {
    for (const id of [
      "*",
      "abc*",
      "*abc",
      "conversation:*",
      "abc:def",
      "abc def",
      "abc\ndef",
      "abc/def",
      "",
      "x".repeat(65),
    ]) {
      assert.equal(
        isSafeChannelId(id),
        false,
        `expected ${JSON.stringify(id)} to be rejected`,
      );
    }
  });

  it("rejects non-strings", () => {
    for (const value of NON_STRINGS) {
      assert.equal(isSafeChannelId(value), false);
    }
  });
});

describe("channel name construction", () => {
  it("builds the documented shapes", () => {
    assert.equal(conversationChannel("abc123"), "conversation:abc123");
    assert.equal(userChannel("user42"), "user:user42");
  });

  it("throws rather than emitting an unsafe channel name", () => {
    for (const unsafe of ["*", "a:b", "a b", "", "x".repeat(65)]) {
      assert.throws(
        () => conversationChannel(unsafe),
        /Unsafe conversation id/,
        `conversationChannel should reject ${JSON.stringify(unsafe)}`,
      );
      assert.throws(
        () => userChannel(unsafe),
        /Unsafe user id/,
        `userChannel should reject ${JSON.stringify(unsafe)}`,
      );
    }
  });
});

describe("isParticipant", () => {
  const participants = { buyerId: "buyer-1", sellerId: "seller-1" };

  it("accepts both parties", () => {
    assert.equal(isParticipant(participants, "buyer-1"), true);
    assert.equal(isParticipant(participants, "seller-1"), true);
  });

  // The authorization primitive the whole feature rests on.
  it("rejects a third party", () => {
    assert.equal(isParticipant(participants, "someone-else"), false);
  });

  it("rejects empty and non-string ids", () => {
    assert.equal(isParticipant(participants, ""), false);
    for (const value of NON_STRINGS) {
      assert.equal(isParticipant(participants, value), false);
    }
  });
});

describe("counterpartyId", () => {
  const participants = { buyerId: "buyer-1", sellerId: "seller-1" };

  it("returns the other party from each side", () => {
    assert.equal(counterpartyId(participants, "buyer-1"), "seller-1");
    assert.equal(counterpartyId(participants, "seller-1"), "buyer-1");
  });

  it("throws for a non-participant rather than returning someone's id", () => {
    assert.throws(
      () => counterpartyId(participants, "someone-else"),
      /not a participant/,
    );
  });
});
