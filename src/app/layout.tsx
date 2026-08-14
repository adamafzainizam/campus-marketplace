import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
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
      </body>
    </html>
  );
}
