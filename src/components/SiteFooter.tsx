import Link from "next/link";
import {
  AFFILIATION_DISCLAIMER,
  legalPath,
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCUMENTS,
} from "@/lib/legal";

/**
 * Site-wide footer: the affiliation disclaimer, the legal documents, contact.
 *
 * The disclaimer is here rather than only on the page that explains it, and
 * that placement is the whole point. The site is called "GMI Campus
 * Marketplace" and only admits institutional accounts, so a visitor's default
 * assumption is that the institute runs it. A correction filed away behind a
 * link they will never click does not correct anything; it has to be on the
 * page they are already looking at.
 *
 * Deliberately not sticky and not translucent, unlike the header. The header is
 * a control surface you reach for mid-task; this is an endnote, and it should
 * be found at the end rather than following you around.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--surface-sunken)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-fine text-secondary">{AFFILIATION_DISCLAIMER}</p>

        <nav
          aria-label="Legal"
          className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          {LEGAL_DOCUMENTS.map((doc) => (
            <Link
              key={doc.slug}
              href={legalPath(doc.slug)}
              className="text-fine text-secondary underline-offset-2 hover:text-content hover:underline"
            >
              {doc.title}
            </Link>
          ))}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="text-fine text-secondary underline-offset-2 hover:text-content hover:underline"
          >
            Contact
          </a>
        </nav>

        <p className="mt-4 text-fine text-tertiary">
          A student portfolio project. Built with Next.js; source on{" "}
          <a
            href="https://github.com/adamafzainizam/campus-marketplace"
            className="underline underline-offset-2 hover:text-secondary"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
