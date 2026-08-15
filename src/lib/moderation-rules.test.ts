import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Relative imports with explicit extensions, transitively — see Gotchas #21/#23.
import { ModerationAction, UserRole } from "../generated/prisma/enums.ts";
import {
  canModerateContent,
  canModerateUser,
  isAdmin,
  isMutatingAction,
  isSuspended,
  MAX_REASON_LENGTH,
  MIN_REASON_LENGTH,
  moderationActionLabel,
  suspensionMessage,
  validateModerationReason,
} from "./moderation-rules.ts";

const admin = { id: "admin-1", role: UserRole.ADMIN };
const user = { id: "user-1", role: UserRole.USER };

describe("isAdmin", () => {
  it("recognises an administrator", () => {
    assert.equal(isAdmin(admin), true);
  });

  it("rejects an ordinary user", () => {
    assert.equal(isAdmin(user), false);
  });

  it("rejects nobody at all", () => {
    // A signed-out visitor reaches these checks as null/undefined, and the
    // dangerous failure here is defaulting to "sure, you're an admin".
    assert.equal(isAdmin(null), false);
    assert.equal(isAdmin(undefined), false);
  });

  it("is not satisfied by a lookalike role string", () => {
    for (const role of ["admin", "Admin", "ADMINISTRATOR", "", "USER"]) {
      assert.equal(
        isAdmin({ id: "x", role: role as UserRole }),
        false,
        `${JSON.stringify(role)} should not be admin`,
      );
    }
  });
});

describe("isSuspended", () => {
  it("treats a timestamp as suspended", () => {
    assert.equal(isSuspended({ suspendedAt: new Date() }), true);
  });

  it("treats null as active", () => {
    assert.equal(isSuspended({ suspendedAt: null }), false);
  });

  it("treats an unknown user as active rather than suspended", () => {
    // Callers pass a possibly-missing user; guessing "suspended" here would
    // lock out anyone whose record failed to load.
    assert.equal(isSuspended(null), false);
    assert.equal(isSuspended(undefined), false);
  });

  it("counts a suspension dated in the past", () => {
    assert.equal(isSuspended({ suspendedAt: new Date(0) }), true);
  });
});

describe("suspensionMessage", () => {
  it("states the reason, because an unexplained penalty cannot be appealed", () => {
    assert.equal(
      suspensionMessage({ suspendedAt: new Date(), suspendedReason: "Scam listings" }),
      "Your account is suspended: Scam listings",
    );
  });

  it("still says something when no reason was recorded", () => {
    assert.equal(
      suspensionMessage({ suspendedAt: new Date(), suspendedReason: null }),
      "Your account is suspended.",
    );
  });

  it("does not present whitespace as a reason", () => {
    assert.equal(
      suspensionMessage({ suspendedAt: new Date(), suspendedReason: "   " }),
      "Your account is suspended.",
    );
  });
});

describe("canModerateUser", () => {
  it("lets an administrator act on somebody else", () => {
    assert.equal(canModerateUser(admin, "user-1"), true);
  });

  it("refuses an ordinary user", () => {
    assert.equal(canModerateUser(user, "user-2"), false);
  });

  it("refuses a signed-out caller", () => {
    assert.equal(canModerateUser(null, "user-1"), false);
  });

  it("refuses an administrator acting on themselves", () => {
    // The lockout guard. Suspension blocks writes and no route grants ADMIN,
    // so a self-suspension can only be undone by editing the database.
    assert.equal(canModerateUser(admin, admin.id), false);
  });

  it("refuses a missing or non-string target", () => {
    for (const target of [null, undefined, "", 42, {}, []]) {
      assert.equal(canModerateUser(admin, target), false);
    }
  });
});

describe("canModerateContent", () => {
  it("allows an administrator", () => {
    assert.equal(canModerateContent(admin), true);
  });

  it("refuses everyone else", () => {
    assert.equal(canModerateContent(user), false);
    assert.equal(canModerateContent(null), false);
  });

  it("allows an administrator to act on their own content", () => {
    // Unlike a user action, this cannot cause a lockout, so refusing it would
    // be a rule with no victim.
    assert.equal(canModerateContent(admin), true);
  });
});

describe("validateModerationReason", () => {
  it("accepts a sensible reason and trims it", () => {
    const result = validateModerationReason("  Repeated scam listings  ");
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, "Repeated scam listings");
  });

  it("rejects a missing reason", () => {
    for (const input of [null, undefined, 42, {}, [], true]) {
      assert.equal(validateModerationReason(input).ok, false);
    }
  });

  it("rejects a reason that is only whitespace", () => {
    assert.equal(validateModerationReason("        ").ok, false);
  });

  it("rejects one that is too short to be reviewable", () => {
    assert.equal(validateModerationReason("no").ok, false);
    assert.equal(
      validateModerationReason("x".repeat(MIN_REASON_LENGTH - 1)).ok,
      false,
    );
  });

  it("accepts exactly the minimum length", () => {
    assert.equal(validateModerationReason("x".repeat(MIN_REASON_LENGTH)).ok, true);
  });

  it("accepts exactly the maximum length", () => {
    assert.equal(validateModerationReason("x".repeat(MAX_REASON_LENGTH)).ok, true);
  });

  it("rejects one character over the maximum", () => {
    assert.equal(
      validateModerationReason("x".repeat(MAX_REASON_LENGTH + 1)).ok,
      false,
    );
  });

  it("measures length after trimming, not before", () => {
    // "  ok  " is 6 characters but 2 of content; padding must not buy its way
    // past the minimum.
    assert.equal(validateModerationReason("  ab  ").ok, false);
  });
});

describe("moderationActionLabel", () => {
  it("labels every action", () => {
    for (const action of Object.values(ModerationAction)) {
      const label = moderationActionLabel(action);
      assert.ok(label.length > 0, `${action} has no label`);
      assert.notEqual(label, "undefined");
    }
  });

  it("distinguishes suspending from reinstating", () => {
    assert.notEqual(
      moderationActionLabel(ModerationAction.USER_SUSPENDED),
      moderationActionLabel(ModerationAction.USER_REINSTATED),
    );
  });
});

describe("isMutatingAction", () => {
  it("treats viewing a reported message as non-mutating", () => {
    assert.equal(isMutatingAction(ModerationAction.MESSAGE_VIEWED), false);
  });

  it("treats every other action as mutating", () => {
    for (const action of Object.values(ModerationAction)) {
      if (action === ModerationAction.MESSAGE_VIEWED) continue;
      assert.equal(isMutatingAction(action), true, `${action} should be mutating`);
    }
  });
});
