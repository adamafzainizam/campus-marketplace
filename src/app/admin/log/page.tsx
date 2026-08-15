import { notFound } from "next/navigation";
import { currentAdmin, recentModerationLog } from "@/lib/moderation";
import {
  isMutatingAction,
  moderationActionLabel,
} from "@/lib/moderation-rules";

/**
 * The audit trail.
 *
 * Read-only, and not by convention — there is no code path anywhere that
 * updates or deletes a `ModerationLog` row. A record that the people it
 * records can edit is not a record.
 *
 * Actions that only *observed* something are marked, so they don't visually
 * compete with the ones that changed somebody's account.
 */
export default async function ModerationLogPage() {
  if (!(await currentAdmin())) notFound();

  const entries = await recentModerationLog();

  return (
    <div>
      <p className="hint mb-4">
        Every moderation action, newest first. Written in the same transaction
        as the action itself, so this cannot be missing an entry.
      </p>

      {entries.length === 0 ? (
        <p className="text-sm text-secondary">
          Nothing has been moderated yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="card p-4">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">
                  {moderationActionLabel(entry.action)}
                </span>
                {!isMutatingAction(entry.action) && (
                  <span className="badge badge-outline">view only</span>
                )}
                <time
                  dateTime={entry.createdAt.toISOString()}
                  className="ml-auto text-fine text-tertiary"
                >
                  {entry.createdAt.toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </time>
              </div>

              <p className="mt-1 text-sm text-secondary">
                by <strong className="font-medium">{entry.admin.name}</strong>
                {entry.subject && (
                  <>
                    {" "}
                    &middot; affecting{" "}
                    <strong className="font-medium">{entry.subject.name}</strong>
                  </>
                )}
              </p>

              <p className="mt-1 text-sm">{entry.reason}</p>

              <p className="mt-1 text-fine text-tertiary">
                {entry.targetType.toLowerCase()} {entry.targetId}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
