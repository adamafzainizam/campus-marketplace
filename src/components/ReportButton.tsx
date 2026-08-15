"use client";

import { useId, useState, useTransition } from "react";
import { reportContent } from "@/app/reports/actions";
import {
  MAX_DETAIL_LENGTH,
  REPORT_REASONS,
  reportReasonHint,
  reportReasonLabel,
  type ReportableTargetType,
} from "@/lib/report-rules";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal";

/**
 * "Report" — deliberately quiet until pressed.
 *
 * Styled as a small ghost control rather than anything alarming. A prominent
 * report button on every listing makes an ordinary marketplace feel like a
 * dangerous place, and the thing being reported is rare. It has to be findable,
 * not loud.
 *
 * The confirmation deliberately does not say what will happen to the person
 * reported, because nothing may happen — a report is a request to look, not a
 * verdict, and implying otherwise invites people to use it as a weapon.
 */
export function ReportButton({
  targetType,
  targetId,
  label = "Report",
}: {
  targetType: ReportableTargetType;
  targetId: string;
  label?: string;
}) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <p role="status" className="notice notice-success">
        Thanks — this has been sent to a moderator. You won&rsquo;t hear back
        unless we need more from you.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost btn-sm"
      >
        {label}
      </button>
    );
  }

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await reportContent(targetType, targetId, reason, detail);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  };

  return (
    <div className="card mt-3 w-full p-4">
      <fieldset disabled={pending}>
        <legend className="text-sm font-medium">
          What&rsquo;s wrong with this?
        </legend>

        <div className="mt-3 space-y-2">
          {REPORT_REASONS.map((value) => (
            <label
              key={value}
              htmlFor={`${formId}-${value}`}
              className="flex cursor-pointer gap-2"
            >
              <input
                type="radio"
                id={`${formId}-${value}`}
                name={`${formId}-reason`}
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {reportReasonLabel(value)}
                </span>
                <span className="block text-fine text-secondary">
                  {reportReasonHint(value)}
                </span>
              </span>
            </label>
          ))}
        </div>

        <label htmlFor={`${formId}-detail`} className="hint mt-4 block">
          Anything else we should know? (optional)
        </label>
        <textarea
          id={`${formId}-detail`}
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          rows={3}
          maxLength={MAX_DETAIL_LENGTH}
          className="field mt-1 w-full"
          placeholder="What happened, in your own words."
        />

        {error && (
          <p role="alert" className="notice notice-danger mt-3">
            {error}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={pending || !reason}
            className="btn btn-primary btn-sm"
          >
            {pending ? "Sending..." : "Send report"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="btn btn-ghost btn-sm"
          >
            Cancel
          </button>
        </div>

        <p className="hint mt-3">
          If someone is in immediate danger, contact the police (999) or GMI
          security first &mdash; nobody is watching this around the clock. For
          anything urgent you can also email{" "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="underline underline-offset-2"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </fieldset>
    </div>
  );
}
