import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
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
