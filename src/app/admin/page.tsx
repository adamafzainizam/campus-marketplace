import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentAdmin } from "@/lib/moderation";
import { ModeratorAction } from "./ModeratorAction";

const MAX_RESULTS = 50;
const MAX_QUERY_LENGTH = 100;

/**
 * The people list: find an account, see its state, suspend or reinstate it.
 *
 * Emails are shown here and nowhere else in the application. Moderating an
 * account you cannot uniquely identify is guesswork — two students may share
 * a display name — but it is also the one screen where the privacy policy's
 * promise that "your email address is never shown to other users" is
 * deliberately set aside, so it is worth being conscious of.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await currentAdmin();
  // Repeated rather than left to the layout: a layout is not a security
  // boundary in the App Router.
  if (!admin) notFound();

  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, MAX_QUERY_LENGTH) : "";

  const users = await db.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: [{ suspendedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: MAX_RESULTS,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      suspendedAt: true,
      suspendedReason: true,
      _count: { select: { listings: true } },
    },
  });

  return (
    <div>
      <form method="get" className="mb-6 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name or email"
          maxLength={MAX_QUERY_LENGTH}
          className="field flex-1"
          aria-label="Search users"
        />
        <button type="submit" className="btn btn-secondary btn-sm">
          Search
        </button>
      </form>

      <p className="hint mb-4">
        Suspended accounts first. Showing at most {MAX_RESULTS}.
      </p>

      {users.length === 0 ? (
        <p className="text-sm text-secondary">No accounts match that search.</p>
      ) : (
        <ul className="space-y-3">
          {users.map((user) => {
            const suspended = Boolean(user.suspendedAt);
            const isSelf = user.id === admin.id;

            return (
              <li key={user.id} className="card p-4">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {user.name}
                      {user.role === "ADMIN" && (
                        <span className="badge badge-outline ml-2">Admin</span>
                      )}
                      {suspended && (
                        <span className="badge badge-neutral ml-2">Suspended</span>
                      )}
                    </p>
                    <p className="text-fine text-secondary">{user.email}</p>
                    <p className="text-fine text-tertiary">
                      {user._count.listings} listing
                      {user._count.listings === 1 ? "" : "s"}
                    </p>
                    {suspended && user.suspendedReason && (
                      <p className="mt-1 text-fine text-secondary">
                        Reason: {user.suspendedReason}
                      </p>
                    )}
                  </div>

                  {/* No controls against your own account. Suspension blocks
                      writes and nothing in the app grants ADMIN, so a
                      self-suspension could only be undone in the database. The
                      server refuses it too; this just avoids offering it. */}
                  {isSelf ? (
                    <span className="hint">This is you</span>
                  ) : (
                    <ModeratorAction
                      kind={suspended ? "reinstate" : "suspend"}
                      targetId={user.id}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
