import Link from "next/link";
import { notFound } from "next/navigation";
import { currentAdmin } from "@/lib/moderation";
import { reportForReview } from "@/lib/reports";
import { reportReasonLabel, reportStatusLabel } from "@/lib/report-rules";
import { ModerationTargetType, ReportStatus } from "@/generated/prisma/enums";
import { ModeratorAction } from "@/app/admin/ModeratorAction";
import { RevealMessage } from "./RevealMessage";
import { ResolveReport } from "./ResolveReport";

/**
 * One report, with enough of its target to judge it.
 *
 * A listing is public, so it is shown in full. A message is private, so this
 * page shows only who sent it and when — reading it is a separate, logged act
 * behind a button. That asymmetry is the entire privacy design of the feature,
 * expressed in what this page does and does not render.
 */
export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await currentAdmin())) notFound();

  const { id } = await params;
  const review = await reportForReview(id);
  if (!review) notFound();

  const { report, listing, message } = review;
  const subject = listing?.seller ?? message?.sender ?? null;

  return (
    <div>
      <Link href="/admin/reports" className="text-sm text-secondary hover:underline">
        &larr; Back to reports
      </Link>

      <div className="mt-4 flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-semibold">
          {reportReasonLabel(report.reason)}
        </h2>
        <span className="badge badge-neutral">
          {reportStatusLabel(report.status)}
        </span>
        <span className="badge badge-outline">
          {report.targetType.toLowerCase()}
        </span>
      </div>

      <p className="mt-1 text-fine text-secondary">
        Reported by {report.reporter.name} on{" "}
        {report.createdAt.toLocaleString("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
        })}{" "}
        UTC
      </p>

      {report.detail ? (
        <blockquote className="card mt-4 p-4 text-sm">{report.detail}</blockquote>
      ) : (
        <p className="hint mt-4">No further description was given.</p>
      )}

      <h3 className="mt-8 text-sm font-semibold">What was reported</h3>

      {report.targetType === ModerationTargetType.LISTING &&
        (listing ? (
          <div className="card mt-2 p-4">
            <Link
              href={`/listings/${listing.id}`}
              className="font-medium hover:underline"
            >
              {listing.title}
            </Link>
            <p className="mt-1 text-fine text-secondary">
              by {listing.seller.name} &middot; {listing.status.toLowerCase()}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">
              {listing.description}
            </p>

            {listing.status !== "ARCHIVED" && (
              <div className="mt-3">
                <ModeratorAction kind="remove-listing" targetId={listing.id} />
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-secondary">
            That listing no longer exists. The report is kept anyway &mdash; it
            is the record of somebody raising a concern.
          </p>
        ))}

      {report.targetType === ModerationTargetType.MESSAGE &&
        (message ? (
          <div className="card mt-2 p-4">
            <p className="text-sm">
              A message from{" "}
              <strong className="font-medium">{message.sender.name}</strong>,
              sent{" "}
              {message.createdAt.toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "UTC",
              })}{" "}
              UTC.
            </p>
            <RevealMessage messageId={message.id} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-secondary">
            That message no longer exists.
          </p>
        ))}

      {subject && (
        <>
          <h3 className="mt-8 text-sm font-semibold">The account</h3>
          <div className="card mt-2 flex flex-wrap items-center gap-3 p-4">
            <span className="mr-auto text-sm">
              {subject.name}
              {subject.suspendedAt && (
                <span className="badge badge-neutral ml-2">Suspended</span>
              )}
            </span>
            <ModeratorAction
              kind={subject.suspendedAt ? "reinstate" : "suspend"}
              targetId={subject.id}
            />
          </div>
        </>
      )}

      {report.status === ReportStatus.OPEN ? (
        <ResolveReport reportId={report.id} />
      ) : (
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <p className="text-sm">
            Closed as <strong>{reportStatusLabel(report.status)}</strong>
            {report.resolvedBy && <> by {report.resolvedBy.name}</>}
            {report.resolvedAt && (
              <>
                {" "}
                on{" "}
                {report.resolvedAt.toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "UTC",
                })}{" "}
                UTC
              </>
            )}
            .
          </p>
          {report.resolutionNote && (
            <p className="mt-1 text-sm text-secondary">
              {report.resolutionNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
