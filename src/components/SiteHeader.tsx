import Link from "next/link";
import { auth, signOut } from "@/auth";

/**
 * Site-wide header: brand, primary navigation, and — the point of it — who you
 * are signed in as.
 *
 * Previously the header was inline in the home page only, so every other page
 * gave no indication of whether you were signed in. Anyone can browse; posting
 * and messaging require a GMI account, and the header is where that difference
 * becomes visible instead of surfacing as a surprise redirect.
 */
export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          Campus Marketplace
        </Link>

        <nav className="flex flex-wrap items-center gap-3">
          <Link
            href="/messages"
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            Messages
          </Link>
          <Link
            href="/listings/new"
            className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Post a listing
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              <span
                className="max-w-[16rem] truncate text-sm text-zinc-600 dark:text-zinc-400"
                title={user.email ?? undefined}
              >
                {user.name ?? user.email}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  className="text-sm text-zinc-600 underline underline-offset-2 dark:text-zinc-400"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/signin"
              className="text-sm text-zinc-600 underline underline-offset-2 dark:text-zinc-400"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
