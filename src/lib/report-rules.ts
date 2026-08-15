/**
 * Reporting policy — what may be reported, for what reason, and by whom. No I/O.
 *
 * Split from the module that touches the database for the same reason as
 * `moderation-rules.ts`: that one imports `server-only` and so cannot be
 * imported by a test at all (Known Gotchas #24).
 *
 * Relative imports with explicit extensions, transitively — Gotchas #21/#23.
 */

import {
  ModerationTargetType,
  ReportReason,
  ReportStatus,
} from "../generated/prisma/enums.ts";
import { type Result } from "./listing-constraints.ts";

export const MAX_DETAIL_LENGTH = 1000;

/**
 * How many messages either side of a reported one a moderator may see.
 *
 * Not zero, because a single message is often unreadable alone — "yes, bring
 * it tomorrow" is innocent or damning depending on what preceded it, and
 * harassment in particular only makes sense in sequence. Not the whole thread,
 * because one report should not expose an entire private exchange including
 * the uninvolved party's half.
 *
 * Three is enough to establish who said what to whom and in response to what.
 */
export const MESSAGE_CONTEXT_RADIUS = 3;

/**
 * What can be reported.
 *
 * Listings and messages — things someone did — rather than people in the
 * abstract. Every user-to-user interaction here happens through one or the
 * other, so nothing is unreportable; and a report attached to a specific thing
 * is something a moderator can actually evaluate, where "this person is
 * awful" is not.
 *
 * `USER` and `REPORT` exist in `ModerationTargetType` because the audit log
 * uses them. They are deliberately not reportable.
 */
export const REPORTABLE_TARGET_TYPES = [
  ModerationTargetType.LISTING,
  ModerationTargetType.MESSAGE,
] as const;

export type ReportableTargetType = (typeof REPORTABLE_TARGET_TYPES)[number];

/**
 * Reasons, mirroring the sections of the Acceptable Use Policy.
 *
 * Deliberately the same vocabulary: the categories a reporter picks from and
 * the rules they are measuring against should not be two different lists that
 * drift apart. `ACADEMIC_INTEGRITY` is first for the same reason it leads the
 * policy — it is the one specific to a campus.
 */
export function reportReasonLabel(reason: ReportReason): string {
  switch (reason) {
    case ReportReason.ACADEMIC_INTEGRITY:
      return "Academic dishonesty";
    case ReportReason.PROHIBITED_ITEM:
      return "Prohibited item";
    case ReportReason.SCAM:
      return "Scam or fraud";
    case ReportReason.HARASSMENT:
      return "Harassment or abuse";
    case ReportReason.SPAM:
      return "Spam or repeated posting";
    case ReportReason.IMPERSONATION:
      return "Impersonation";
    case ReportReason.OTHER:
      return "Something else";
  }
}

/** A sentence of guidance under each label, so people pick the right one. */
export function reportReasonHint(reason: ReportReason): string {
  switch (reason) {
    case ReportReason.ACADEMIC_INTEGRITY:
      return "Exam papers, completed assignments, or assignment-writing services.";
    case ReportReason.PROHIBITED_ITEM:
      return "Something that isn't allowed to be sold here at all.";
    case ReportReason.SCAM:
      return "Asking for payment up front, or not handing over what was paid for.";
    case ReportReason.HARASSMENT:
      return "Threats, abuse, or unwanted contact.";
    case ReportReason.SPAM:
      return "The same listing over and over, or unsolicited advertising.";
    case ReportReason.IMPERSONATION:
      return "Pretending to be someone else, or to be GMI staff.";
    case ReportReason.OTHER:
      return "Anything else — please describe it below.";
  }
}

/** Ordered for the form: campus-specific first, catch-all last. */
export const REPORT_REASONS = [
  ReportReason.ACADEMIC_INTEGRITY,
  ReportReason.PROHIBITED_ITEM,
  ReportReason.SCAM,
  ReportReason.HARASSMENT,
  ReportReason.SPAM,
  ReportReason.IMPERSONATION,
  ReportReason.OTHER,
] as const;

export function reportStatusLabel(status: ReportStatus): string {
  switch (status) {
    case ReportStatus.OPEN:
      return "Open";
    case ReportStatus.ACTIONED:
      return "Actioned";
    case ReportStatus.DISMISSED:
      return "Dismissed";
  }
}

/**
 * Validates the reason submitted with a report.
 *
 * `Object.hasOwn` rather than a bare lookup, for the reason every allowlist in
 * this codebase uses it (Known Gotchas #15): inherited keys like "constructor"
 * resolve to truthy values off `Object.prototype` and would sail through.
 */
export function validateReportReason(raw: unknown): Result<ReportReason> {
  if (typeof raw !== "string" || !Object.hasOwn(ReportReason, raw)) {
    return { ok: false, error: "Choose a reason for the report." };
  }
  return { ok: true, value: ReportReason[raw as keyof typeof ReportReason] };
}

/** Validates what is being reported. Refuses target types that are not reportable. */
export function validateReportTarget(raw: unknown): Result<ReportableTargetType> {
  if (typeof raw !== "string") {
    return { ok: false, error: "That can't be reported." };
  }
  const match = REPORTABLE_TARGET_TYPES.find((type) => type === raw);
  if (!match) {
    return { ok: false, error: "That can't be reported." };
  }
  return { ok: true, value: match };
}

/**
 * Validates the optional free-text detail.
 *
 * Optional by design: requiring an explanation suppresses reports, and the
 * reason enum already carries the category. Absent and empty both normalise to
 * `null` so the database holds one representation of "nothing said".
 */
export function validateReportDetail(raw: unknown): Result<string | null> {
  if (raw === undefined || raw === null) return { ok: true, value: null };

  if (typeof raw !== "string") {
    return { ok: false, error: "That description isn't valid." };
  }

  const detail = raw.trim();
  if (detail.length === 0) return { ok: true, value: null };

  if (detail.length > MAX_DETAIL_LENGTH) {
    return {
      ok: false,
      error: `Keep the description under ${MAX_DETAIL_LENGTH} characters.`,
    };
  }

  return { ok: true, value: detail };
}

/**
 * Whether someone may report a thing, given who owns it.
 *
 * Reporting your own listing or your own message is refused. Not because it
 * would cause harm, but because it is always either a mistake or an attempt to
 * put noise in the queue, and the queue is the scarce resource when there is
 * one moderator.
 *
 * `ownerId` may be null when ownership could not be established, in which case
 * the report is allowed — failing open here means an unnecessary report, while
 * failing closed would mean a real one silently refused.
 */
export function canReport(
  reporterId: unknown,
  ownerId: string | null | undefined,
): boolean {
  if (typeof reporterId !== "string" || reporterId.length === 0) return false;
  if (!ownerId) return true;
  return reporterId !== ownerId;
}

/**
 * The bounds of the context window around a reported message.
 *
 * Returned as a count to take either side rather than as a slice, because the
 * database does the windowing — fetching a whole conversation and slicing it in
 * application code would mean the unwanted messages had already been read out
 * of the database, which is precisely what this limit exists to prevent.
 */
export function messageContextWindow(radius: number = MESSAGE_CONTEXT_RADIUS): {
  before: number;
  after: number;
} {
  const safe = Number.isInteger(radius) && radius >= 0 ? radius : MESSAGE_CONTEXT_RADIUS;
  return { before: safe, after: safe };
}
