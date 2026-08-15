import Link from "next/link";
import { notFound } from "next/navigation";
import { currentAdmin } from "@/lib/moderation";
import { listReports } from "@/lib/reports";
import { reportReasonLabel, reportStatusLabel } from "@/lib/report-rules";
import { ReportStatus } from "@/generated/prisma/enums";

const TABS = [
  ReportStatus.OPEN,
  ReportStatus.ACTIONED,
  ReportStatus.DISMISSED,
] as const;

/**
 * The triage queue.
 *
 * **Oldest first**, which is the opposite of the audit log and deliberate: a
 * queue sorted newest-first quietly abandons the reports at the bottom, and
 * the oldest unanswered complaint is the one most likely to have been a real
 * problem that nobody dealt with.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!(await currentAdmin())) notFound();

  const { status: rawStatus } = await searchParams;
  const status =
    TABS.find((tab) => tab === rawStatus) ?? ReportStatus.OPEN;

  const reports = await listReports(status);

  return (
    <div>
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Report status">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={`/admin/reports?status=${tab}`}
            className={`chip ${tab === status ? "chip-selected" : ""}`}
          >
            {reportStatusLabel(tab)}
          </Link>
        ))}
      </nav>

      <p className="hint mb-4">
        Oldest first &mdash; the longest-unanswered report is the one most
        likely to matter.
      </p>

      {reports.length === 0 ? (
        <p className="text-sm text-secondary">
          {status === ReportStatus.OPEN
            ? "Nothing waiting. "
            : "Nothing here. "}
          {status === ReportStatus.OPEN &&
            "Reports raised from a listing or a message land here."}
        </p>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li key={report.id}>
              <Link
                href={`/admin/reports/${report.id}`}
                className="card card-interactive block p-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">
                    {reportReasonLabel(report.reason)}
                  </span>
                  <span className="badge badge-outline">
                    {report.targetType.toLowerCase()}
                  </span>
                  <time
                    dateTime={report.createdAt.toISOString()}
                    className="ml-auto text-fine text-tertiary"
                  >
                    {report.createdAt.toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                </div>

                <p className="mt-1 text-fine text-secondary">
                  reported by {report.reporter.name}
                </p>

                {report.detail && (
                  <p className="mt-2 line-clamp-2 text-sm">{report.detail}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
