"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveReportAction } from "@/app/admin/actions";
import { MIN_REASON_LENGTH } from "@/lib/moderation-rules";
import { ReportStatus } from "@/generated/prisma/enums";

/**
 * Closes a report, one way or the other.
 *
 * A note is required for **both** outcomes. Dismissal is the decision an
 * unaccountable moderator is most likely to make badly, precisely because it
 * leaves no trace anywhere else — so it writes an audit-log entry, and it
 * cannot be done without saying why.
 */
export function ResolveReport({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const resolve = (status: typeof ReportStatus.ACTIONED | typeof ReportStatus.DISMISSED) => {
    setError(null);
    startTransition(async () => {
      const result = await resolveReportAction(reportId, status, note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="mt-6 border-t border-[var(--border)] pt-4">
      <label htmlFor="resolution-note" className="hint block">
        What did you decide, and why? (at least {MIN_REASON_LENGTH} characters,
        recorded against your name)
      </label>
      <textarea
        id="resolution-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        className="field mt-1 w-full"
        placeholder="Removed the listing — it was an exam paper."
        disabled={pending}
      />

      {error && (
        <p role="alert" className="notice notice-danger mt-2">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => resolve(ReportStatus.ACTIONED)}
          disabled={pending}
          className="btn btn-primary btn-sm"
        >
          {pending ? "Working..." : "Close — action taken"}
        </button>
        <button
          type="button"
          onClick={() => resolve(ReportStatus.DISMISSED)}
          disabled={pending}
          className="btn btn-secondary btn-sm"
        >
          Close — nothing needed
        </button>
      </div>

      <p className="hint mt-2">
        Take the action itself first (remove the listing, suspend the account),
        then close this. Each action writes its own log entry.
      </p>
    </div>
  );
}
