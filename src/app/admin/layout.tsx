import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { currentAdmin } from "@/lib/moderation";
import { openReportCount } from "@/lib/reports";

export const metadata: Metadata = {
  title: "Moderation",
  // Nothing here should ever be indexed, and the pages 404 for anyone without
  // the role anyway — this is belt and braces, not the control.
  robots: { index: false, follow: false },
};

/**
 * Guard and frame for the moderation area.
 *
 * `notFound()` rather than a 403. A 403 confirms the route exists, and an
 * admin area that answers differently for "you may not" and "there is nothing
 * here" hands a prober a map. Every page under here repeats the check rather
 * than relying on this layout: a layout is not a security boundary in the App
 * Router, since it does not necessarily re-run for every navigation.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!(await currentAdmin())) notFound();

  const openReports = await openReportCount();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto">
          Moderation
        </h1>
        <Link href="/admin/reports" className="btn btn-ghost btn-sm">
          Reports
          {/* The count is the only reason to look at this area on most days,
              so it belongs in the nav rather than one click further in. */}
          {openReports > 0 && (
            <span className="badge badge-accent ml-1.5">{openReports}</span>
          )}
        </Link>
        <Link href="/admin" className="btn btn-ghost btn-sm">
          Users
        </Link>
        <Link href="/admin/log" className="btn btn-ghost btn-sm">
          Audit log
        </Link>
      </div>

      {children}
    </div>
  );
}
