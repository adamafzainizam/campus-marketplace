import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ModerationTargetType,
  ReportReason,
  ReportStatus,
} from "../generated/prisma/enums.ts";
import {
  canReport,
  MAX_DETAIL_LENGTH,
  messageContextWindow,
  MESSAGE_CONTEXT_RADIUS,
  REPORTABLE_TARGET_TYPES,
  REPORT_REASONS,
  reportReasonHint,
  reportReasonLabel,
  reportStatusLabel,
  validateReportDetail,
  validateReportReason,
  validateReportTarget,
} from "./report-rules.ts";

describe("REPORT_REASONS", () => {
  it("offers every reason the database allows", () => {
    assert.deepEqual(
      [...REPORT_REASONS].sort(),
      Object.values(ReportReason).sort(),
    );
  });

  it("leads with academic integrity, matching the policy it mirrors", () => {
    assert.equal(REPORT_REASONS[0], ReportReason.ACADEMIC_INTEGRITY);
  });

  it("ends with the catch-all, so it isn't the path of least resistance", () => {
    assert.equal(REPORT_REASONS.at(-1), ReportReason.OTHER);
  });

  it("labels and hints every reason", () => {
    for (const reason of Object.values(ReportReason)) {
      assert.ok(reportReasonLabel(reason).length > 0, `${reason} has no label`);
      assert.ok(reportReasonHint(reason).length > 0, `${reason} has no hint`);
      assert.notEqual(reportReasonLabel(reason), "undefined");
    }
  });

  it("gives every reason a distinct label", () => {
    const labels = Object.values(ReportReason).map(reportReasonLabel);
    assert.equal(new Set(labels).size, labels.length);
  });
});

describe("validateReportReason", () => {
  it("accepts every real reason", () => {
    for (const reason of Object.values(ReportReason)) {
      const result = validateReportReason(reason);
      assert.equal(result.ok, true, `${reason} was rejected`);
      assert.equal(result.ok && result.value, reason);
    }
  });

  it("rejects an unknown reason", () => {
    assert.equal(validateReportReason("BECAUSE_I_SAY_SO").ok, false);
  });

  it("rejects non-strings", () => {
    for (const input of [null, undefined, 42, {}, [], true]) {
      assert.equal(validateReportReason(input).ok, false);
    }
  });

  it("is not fooled by inherited object properties", () => {
    // Known Gotchas #15 — a bare lookup would resolve these off Object.prototype.
    for (const key of ["constructor", "toString", "valueOf", "hasOwnProperty"]) {
      assert.equal(validateReportReason(key).ok, false, `${key} was accepted`);
    }
  });

  it("is case-sensitive, so a lowercase guess does not slip through", () => {
    assert.equal(validateReportReason("scam").ok, false);
  });
});

describe("validateReportTarget", () => {
  it("accepts listings and messages", () => {
    assert.equal(validateReportTarget(ModerationTargetType.LISTING).ok, true);
    assert.equal(validateReportTarget(ModerationTargetType.MESSAGE).ok, true);
  });

  it("refuses target types that exist for the audit log but are not reportable", () => {
    // USER and REPORT are valid ModerationTargetType values, which is exactly
    // why this needs asserting: the enum is wider than what may be reported.
    assert.equal(validateReportTarget(ModerationTargetType.USER).ok, false);
    assert.equal(validateReportTarget(ModerationTargetType.REPORT).ok, false);
  });

  it("rejects nonsense and non-strings", () => {
    for (const input of [null, undefined, 42, {}, [], "LISTINGS", "constructor"]) {
      assert.equal(validateReportTarget(input).ok, false);
    }
  });

  it("exposes only reportable types in REPORTABLE_TARGET_TYPES", () => {
    assert.deepEqual([...REPORTABLE_TARGET_TYPES], ["LISTING", "MESSAGE"]);
  });
});

describe("validateReportDetail", () => {
  it("treats absent detail as nothing said", () => {
    assert.deepEqual(validateReportDetail(undefined), { ok: true, value: null });
    assert.deepEqual(validateReportDetail(null), { ok: true, value: null });
  });

  it("normalises empty and whitespace-only text to null", () => {
    // One representation of "nothing said" in the database, not three.
    assert.deepEqual(validateReportDetail(""), { ok: true, value: null });
    assert.deepEqual(validateReportDetail("    "), { ok: true, value: null });
  });

  it("trims what it keeps", () => {
    assert.deepEqual(validateReportDetail("  they never showed up  "), {
      ok: true,
      value: "they never showed up",
    });
  });

  it("accepts exactly the maximum length", () => {
    assert.equal(validateReportDetail("x".repeat(MAX_DETAIL_LENGTH)).ok, true);
  });

  it("rejects one character over", () => {
    assert.equal(validateReportDetail("x".repeat(MAX_DETAIL_LENGTH + 1)).ok, false);
  });

  it("measures after trimming", () => {
    const padded = `  ${"x".repeat(MAX_DETAIL_LENGTH)}  `;
    assert.equal(validateReportDetail(padded).ok, true);
  });

  it("rejects non-strings that are not absent", () => {
    for (const input of [42, {}, [], true]) {
      assert.equal(validateReportDetail(input).ok, false);
    }
  });
});

describe("canReport", () => {
  it("allows reporting someone else's content", () => {
    assert.equal(canReport("user-1", "user-2"), true);
  });

  it("refuses reporting your own content", () => {
    assert.equal(canReport("user-1", "user-1"), false);
  });

  it("refuses a signed-out or malformed reporter", () => {
    for (const input of [null, undefined, "", 42, {}]) {
      assert.equal(canReport(input, "user-2"), false);
    }
  });

  it("fails open when ownership is unknown", () => {
    // An unnecessary report is a smaller harm than a real one silently refused.
    assert.equal(canReport("user-1", null), true);
    assert.equal(canReport("user-1", undefined), true);
  });
});

describe("messageContextWindow", () => {
  it("defaults to the declared radius on both sides", () => {
    assert.deepEqual(messageContextWindow(), {
      before: MESSAGE_CONTEXT_RADIUS,
      after: MESSAGE_CONTEXT_RADIUS,
    });
  });

  it("is symmetric, so context is not biased toward one speaker", () => {
    const window = messageContextWindow(5);
    assert.equal(window.before, window.after);
  });

  it("allows a window of zero", () => {
    assert.deepEqual(messageContextWindow(0), { before: 0, after: 0 });
  });

  it("falls back to the default rather than widening on bad input", () => {
    // The dangerous failure is a negative or fractional radius quietly
    // becoming "everything", which would expose a whole conversation.
    for (const bad of [-1, 1.5, NaN, Infinity]) {
      assert.deepEqual(messageContextWindow(bad), {
        before: MESSAGE_CONTEXT_RADIUS,
        after: MESSAGE_CONTEXT_RADIUS,
      });
    }
  });

  it("keeps the default small enough not to be a whole thread", () => {
    assert.ok(MESSAGE_CONTEXT_RADIUS > 0 && MESSAGE_CONTEXT_RADIUS <= 5);
  });
});

describe("reportStatusLabel", () => {
  it("labels every status distinctly", () => {
    const labels = Object.values(ReportStatus).map(reportStatusLabel);
    assert.equal(new Set(labels).size, labels.length);
    for (const label of labels) assert.ok(label.length > 0);
  });
});
