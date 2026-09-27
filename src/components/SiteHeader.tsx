import Link from "next/link";
import { HeaderNav } from "@/components/HeaderNav";
import { PinMark } from "@/components/PinMark";
import { auth, signOut } from "@/auth";

/**
 * Site-wide header: the brand, then everything in HeaderNav.
 *
 * Solid, like paper, with the notice board's 2px ink rule beneath it
 * (`.chrome`). This stays a Server Component because it reads the session;
 * HeaderNav is the client part, because marking the current section needs
 * the path.
 *
 * The wordmark hides below `sm`, which is the whole reason to own a mark:
 * the words cannot shrink past "Marketplace", and on a 360px phone the
 * header has no room for them beside the menu, the theme toggle and
 * "Post a listing".
 */
export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;
  const userLabel = user ? (user.name ?? user.email ?? "your account") : null;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <header className="chrome sticky top-0 z-50">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center gap-2 px-3 py-2 sm:min-h-16 sm:gap-3 sm:px-6">
        <Link
          href="/"
          className="pressable flex shrink-0 items-center gap-2 text-base font-extrabold"
        >
          <PinMark />
          <span className="hidden sm:inline">GMI Campus Marketplace</span>
          <span className="sr-only sm:hidden">GMI Campus Marketplace</span>
        </Link>
        <HeaderNav userLabel={userLabel} signOut={signOutAction} />
      </div>
    </header>
  );
}
