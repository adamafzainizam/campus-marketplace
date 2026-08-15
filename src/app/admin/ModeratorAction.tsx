"use client";

import { useState, useTransition } from "react";
import {
  reinstateUserAction,
  removeListingAction,
  suspendUserAction,
} from "./actions";
import { MIN_REASON_LENGTH } from "@/lib/moderation-rules";

type Kind = "suspend" | "reinstate" | "remove-listing";

const COPY: Record<
  Kind,
  { open: string; confirm: string; placeholder: string; danger: boolean }
> = {
  suspend: {
    open: "Suspend",
    confirm: "Suspend account",
    placeholder: "Why is this account being suspended?",
    danger: true,
  },
  reinstate: {
    open: "Reinstate",
    confirm: "Reinstate account",
    placeholder: "Why is this suspension being lifted?",
    danger: false,
  },
  "remove-listing": {
    open: "Remove listing",
    confirm: "Remove listing",
    placeholder: "Which rule does this listing break?",
    danger: true,
  },
};

/**
 * A moderation control: a button that opens a reason field, then acts.
 *
 * The reason is not optional and there is no way to skip past it. That is
 * deliberate friction — the audit log's value is in the *why*, and a field
 * that can be left blank is a field that will be left blank. It also imposes
 * a moment's thought before an action that affects someone else's account.
 *
 * Errors are shown inline. Every failure that can reach here is expected —
 * "already suspended", "reason too short" — and is returned rather than
 * thrown, so the message shown is the real one rather than a production
 * digest (Known Gotchas #35).
 */
export function ModeratorAction({
  kind,
  targetId,
}: {
  kind: Kind;
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const copy = COPY[kind];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn btn-sm ${copy.danger ? "btn-secondary" : "btn-ghost"}`}
      >
        {copy.open}
      </button>
    );
  }

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result =
        kind === "suspend"
          ? await suspendUserAction(targetId, reason)
          : kind === "reinstate"
            ? await reinstateUserAction(targetId, reason)
            : await removeListingAction(targetId, reason);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setReason("");
    });
  };

  return (
    <div className="mt-2 w-full">
      <label className="hint block" htmlFor={`reason-${kind}-${targetId}`}>
        Reason (recorded in the audit log, at least {MIN_REASON_LENGTH}{" "}
        characters)
      </label>
      <textarea
        id={`reason-${kind}-${targetId}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
        className="field mt-1 w-full"
        placeholder={copy.placeholder}
        disabled={pending}
      />

      {error && (
        <p role="alert" className="notice notice-danger mt-2">
          {error}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="btn btn-primary btn-sm"
        >
          {pending ? "Working..." : copy.confirm}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={pending}
          className="btn btn-ghost btn-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
