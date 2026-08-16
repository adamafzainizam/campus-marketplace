import Link from "next/link";
import { PendingLink } from "@/components/PendingLink";
import { PinMark } from "@/components/PinMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { auth, signOut } from "@/auth";

/**
 * Site-wide header: brand, primary navigation, and who you are signed in as.
 *
 * Built as a translucent material that content scrolls *under*, rather than an
 * opaque bar consuming a fixed strip of the viewport. The saturation bump and
 * the border are what stop it reading as flat grey — it should look like light
 * catching a surface.
 *
 * Nav labels name their destination ("My listings", "Messages") rather than
 * vague umbrellas: specificity is what makes navigation predictable.
 */
export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="chrome sticky top-0 z-50">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
        <Link
          href="/"
          className="pressable mr-auto flex items-center gap-2 text-[0.9375rem] font-semibold tracking-[-0.01em] sm:text-base"
        >
          <PinMark />
          {/* The wordmark is one colour now: the mark carries the accent, and
              an accent square beside accent text is two things competing to
              be the first thing you look at.

              Hidden below `sm`, which is the whole reason to own a mark. The
              words cannot shrink past "Marketplace" and every nav button is
              nowrap, so on a 360px phone a signed-in header wanted about 450px
              and pushed the entire page into horizontal scroll — a strip of
              dead space down the right of every screen. */}
          <span className="hidden sm:inline">GMI Campus Marketplace</span>
          <span className="sr-only sm:hidden">GMI Campus Marketplace</span>
        </Link>

        {/* Wraps rather than overflowing, as a floor. The widths above are what
            a default text size produces, and someone running large type can
            exceed any budget we pick — wrapping makes the header taller, which
            is survivable, where overflowing takes the whole page with it.
            Wrapping rather than scrolling because a scroll container clips the
            focus ring drawn outside each button, and because an action nobody
            can see is worse than a header on two lines. */}
        <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          <ThemeToggle />
          {user && (
            <PendingLink href="/listings/mine" className="btn btn-ghost btn-sm">
              <span className="hidden sm:inline">My listings</span>
              <span className="sm:hidden">Mine</span>
            </PendingLink>
          )}
          <PendingLink href="/messages" className="btn btn-ghost btn-sm">
            Messages
          </PendingLink>
          <PendingLink href="/listings/new" className="btn btn-primary btn-sm">
            <span className="hidden sm:inline">Post a listing</span>
            <span className="sm:hidden">Post</span>
          </PendingLink>

          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span
                className="hidden max-w-[9rem] truncate text-fine text-secondary lg:inline"
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
                <button type="submit" className="btn btn-ghost btn-sm">
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <PendingLink href="/signin" className="btn btn-ghost btn-sm">
              Sign in
            </PendingLink>
          )}
        </nav>
      </div>
    </header>
  );
}
