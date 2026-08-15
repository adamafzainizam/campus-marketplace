import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  formatEffectiveDate,
  legalPath,
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCUMENTS,
  type LegalDocument,
} from "@/lib/legal";

/**
 * Chrome shared by every legal document: breadcrumbs, title, effective date,
 * the prose body, and a consistent contact line at the end.
 *
 * Each document supplies only its own text. The date, the contact address, and
 * the sibling links come from `@/lib/legal`, so a change to any of them lands
 * on all four pages at once instead of on the three somebody remembered.
 */
export function LegalDocumentPage({
  doc,
  children,
}: {
  doc: LegalDocument;
  children: React.ReactNode;
}) {
  const siblings = LEGAL_DOCUMENTS.filter((other) => other.slug !== doc.slug);

  return (
    <article>
      <Breadcrumbs
        items={[{ label: "Legal", href: "/legal" }, { label: doc.title }]}
      />

      <h1>{doc.title}</h1>

      <p className="mt-2 text-fine text-secondary">
        Last updated {formatEffectiveDate()}
      </p>

      <div className="prose mt-8">{children}</div>

      <hr className="mt-12 border-0 border-t border-[var(--border)]" />

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Questions about this document</h2>
        <p className="mt-2 text-sm text-secondary">
          Write to{" "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="text-accent underline underline-offset-2"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          . This is a student project run by one person, so a reply may take a
          few days — but every message is read.
        </p>
      </section>

      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Other legal documents">
        {siblings.map((other) => (
          <Link key={other.slug} href={legalPath(other.slug)} className="chip">
            {other.title}
          </Link>
        ))}
      </nav>
    </article>
  );
}
