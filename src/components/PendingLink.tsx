"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";

/**
 * A link that reports its own pending state while the next route loads.
 *
 * Every route in this app is dynamic — each one reads the session or the
 * database — so navigation always costs a server round trip, and the database
 * sleeps on the free tier. `loading.tsx` covers the destination, but there is
 * a gap before it paints where the *clicked element* has said nothing. That
 * gap is what makes an interface feel broken rather than slow: the user's
 * question is "did my click register", and a spinner elsewhere on the page
 * doesn't answer it.
 *
 * `useLinkStatus` must be used inside a descendant of `Link`, hence the inner
 * component.
 */

function PendingState({
  className,
  pendingClassName,
  children,
}: {
  className: string;
  pendingClassName: string;
  children: React.ReactNode;
}) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={`${className}${pending ? ` ${pendingClassName}` : ""}`}
      // Announced only while actually pending, so screen readers aren't told
      // about every link on the page.
      aria-busy={pending || undefined}
    >
      {children}
    </span>
  );
}

export function PendingLink({
  href,
  className = "",
  innerClassName = "",
  pendingClassName = "nav-pending",
  children,
  ...rest
}: {
  href: string;
  className?: string;
  /** Applied to the inner element that gains the pending treatment. */
  innerClassName?: string;
  pendingClassName?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={className} {...rest}>
      <PendingState className={innerClassName} pendingClassName={pendingClassName}>
        {children}
      </PendingState>
    </Link>
  );
}
