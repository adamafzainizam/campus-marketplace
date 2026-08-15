"use client";

import { useState, useTransition } from "react";
import {
  revealReportedMessageAction,
  type RevealedMessages,
} from "@/app/admin/actions";
import { MESSAGE_CONTEXT_RADIUS } from "@/lib/report-rules";

/**
 * Reveals a reported message and a few either side.
 *
 * Behind a button rather than rendered with the page, on purpose. Reading
 * somebody's private message should be an act a moderator chooses, not
 * something that happens because they opened a URL — and since the reveal
 * writes an audit-log entry, rendering it automatically would fill the log
 * with views nobody meant to make, which devalues every real entry in it.
 *
 * The warning is shown before the content, not after.
 */
export function RevealMessage({ messageId }: { messageId: string }) {
  const [revealed, setRevealed] = useState<RevealedMessages | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (revealed) {
    return (
      <div className="mt-3">
        <p className="hint mb-2">
          The reported message is highlighted. {MESSAGE_CONTEXT_RADIUS} either
          side are shown for context; the rest of the conversation was not read.
        </p>
        <ul className="space-y-2">
          {revealed.messages.map((message) => {
            const isReported = message.id === revealed.reportedId;
            return (
              <li
                key={message.id}
                className={`rounded-lg border p-3 text-sm ${
                  isReported
                    ? "border-[var(--danger)] bg-[var(--danger-subtle)]"
                    : "border-line bg-surface-sunken"
                }`}
              >
                <p className="text-fine text-secondary">
                  {message.senderName} &middot;{" "}
                  {new Date(message.createdAt).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                  {isReported && " · reported"}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words">
                  {message.body}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <p className="notice notice-danger mb-2">
        This shows a private message. Doing so is recorded in the audit log
        against your name, with the reason &ldquo;viewed in response to a
        report&rdquo;. Only the reported message and {MESSAGE_CONTEXT_RADIUS}{" "}
        either side are read &mdash; never the whole conversation.
      </p>

      {error && (
        <p role="alert" className="notice notice-danger mb-2">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await revealReportedMessageAction(messageId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setRevealed(result.value);
          });
        }}
        className="btn btn-secondary btn-sm"
      >
        {pending ? "Loading..." : "Show the reported message"}
      </button>
    </div>
  );
}
