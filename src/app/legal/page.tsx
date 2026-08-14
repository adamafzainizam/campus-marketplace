import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  AFFILIATION_DISCLAIMER,
  formatEffectiveDate,
  legalPath,
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCUMENTS,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Legal",
  description:
    "Terms of Service, Privacy Policy, Acceptable Use Policy, and disclaimer for GMI Campus Marketplace.",
};

export default function LegalIndexPage() {
  return (
    <div>
      <Breadcrumbs items={[{ label: "Legal" }]} />

      <h1 className="text-2xl font-semibold tracking-[-0.014em]">Legal</h1>

      <p className="mt-3 text-sm text-secondary">
        All four documents, last updated {formatEffectiveDate()}. They are
        written to be read, not to be impenetrable &mdash; if any part
        isn&rsquo;t clear, say so and it will be reworded.
      </p>

      <p className="notice notice-danger mt-6">{AFFILIATION_DISCLAIMER}</p>

      <ul className="mt-8 space-y-3">
        {LEGAL_DOCUMENTS.map((doc) => (
          <li key={doc.slug}>
            <Link
              href={legalPath(doc.slug)}
              className="card card-interactive block p-4"
            >
              <span className="font-medium">{doc.title}</span>
              <span className="mt-1 block text-sm text-secondary">
                {doc.summary}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-secondary">
        Questions, corrections, or takedown requests:{" "}
        <a
          href={`mailto:${LEGAL_CONTACT_EMAIL}`}
          className="text-accent underline underline-offset-2"
        >
          {LEGAL_CONTACT_EMAIL}
        </a>
      </p>
    </div>
  );
}
