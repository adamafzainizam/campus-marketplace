import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SuspensionBanner } from "@/components/SuspensionBanner";
import "./globals.css";

/**
 * Two families, loaded through next/font so they are self-hosted at build
 * time. The CSP is `font-src 'self' data:` — a <link> to fonts.googleapis.com
 * would be blocked, and would be the fourth outage that policy has caused.
 *
 * Space Grotesk carries headings and prices; Inter carries body and UI. A
 * distinctive face on small text gets tiring, which is why the split exists.
 */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Named for the institution rather than generically: this is GMI's
  // marketplace, not a campus marketplace in the abstract.
  title: {
    default: "GMI Campus Marketplace",
    template: "%s | GMI Campus Marketplace",
  },
  description:
    "Buy, sell, and rent secondhand items within the German-Malaysian Institute community.",
};

/**
 * Stated explicitly rather than relying on the framework default. Without
 * `width=device-width` a phone renders the page at a virtual desktop width and
 * then zooms out, which makes every responsive breakpoint below inert.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
      /*
        Browser extensions write their own attributes onto <html> before React
        hydrates — a password manager, a recorder, an accessibility tool — and
        each one produces a hydration error that looks like an application bug
        and is not. The one that prompted this was Katalon Recorder adding
        `katalonextensionid`.

        This suppresses the warning for *this element's own attributes only*.
        It does not cascade to children, so it cannot hide a real mismatch
        inside a page. What it could hide is a genuine <html> attribute
        mismatch — and there is nothing here to produce one: `lang` is a
        literal and the class names come from `next/font` at build time. Dark
        mode is pure CSS with no theme script, which is the usual reason this
        element's attributes change at runtime.

        Reconsider if a script is ever added that sets an attribute on <html>.
      */
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        {/* Renders nothing for everyone except a suspended user — see the
            component for why it is site-wide rather than only on write pages. */}
        <SuspensionBanner />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        {/*
          The footer carries the affiliation disclaimer, so it belongs on every
          page rather than only where it is convenient — a visitor's default
          assumption is that the institute runs this, and a correction is only
          worth anything on the page they are actually looking at.

          One exception, in globals.css: the conversation thread hides it. That
          page sizes itself to the remaining viewport and scrolls internally, so
          a footer would take a fixed slice out of an already-cramped chat on a
          phone. See Known Gotchas #33 — the header caused the same problem.
        */}
        <SiteFooter />
      </body>
    </html>
  );
}
