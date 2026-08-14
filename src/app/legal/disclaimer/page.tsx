import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocumentPage } from "../LegalDocumentPage";
import { ALLOWED_DOMAIN_LABEL } from "@/lib/auth-domain";
import {
  AFFILIATION_DISCLAIMER,
  findLegalDocument,
  legalPath,
  LEGAL_CONTACT_EMAIL,
} from "@/lib/legal";

const doc = findLegalDocument("disclaimer")!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
};

export default function DisclaimerPage() {
  return (
    <LegalDocumentPage doc={doc}>
      <p className="notice notice-danger">{AFFILIATION_DISCLAIMER}</p>

      <h2>1. This is a student project</h2>
      <p>
        GMI Campus Marketplace was built by a single student as a portfolio
        project, to demonstrate the ability to design and ship a working
        application. It is run in that student&rsquo;s personal capacity, on
        personal accounts, at no cost to anyone.
      </p>
      <p>
        The German-Malaysian Institute has not commissioned it, does not
        operate it, does not fund it, does not moderate it, and is not
        responsible for it. Nothing on this site is an official GMI
        announcement, service, policy, or endorsement.
      </p>

      <h2>2. Why the name says GMI</h2>
      <p>
        The name describes <em>who the service is for</em> &mdash; people with a{" "}
        {ALLOWED_DOMAIN_LABEL} account &mdash; not who runs it. The word is used
        to identify the community the service serves, in the same way a student
        society might describe itself by its campus, and not to suggest official
        standing.
      </p>
      <p>
        &ldquo;German-Malaysian Institute&rdquo;, &ldquo;GMI&rdquo;, and any GMI
        logo or mark belong to the German-Malaysian Institute. No claim is made
        to them. No GMI logo, crest, or branding is used anywhere on this site.
      </p>

      <h2>3. Nothing here is checked or endorsed</h2>
      <p>
        Listings are written by users. They are not reviewed, verified, valued,
        or approved before appearing, and their appearance here is not a
        recommendation of the item, the price, or the person offering it. The
        same goes for anything said in a message.
      </p>
      <p>
        Restricting sign-in to institutional accounts means you are dealing with
        someone who holds a GMI email address. It does not mean they are honest,
        and it is not a background check.
      </p>

      <h2>4. Not professional advice</h2>
      <p>
        Nothing on this site is legal, financial, or safety advice. If a
        transaction matters enough to need advice, get it from someone
        qualified.
      </p>

      <h2>5. Liability</h2>
      <p>
        The limits on liability are set out in the{" "}
        <Link href={legalPath("terms")}>Terms of Service</Link>, and the handling
        of personal data in the{" "}
        <Link href={legalPath("privacy")}>Privacy Policy</Link>. In short: the
        service is a noticeboard, it is not party to your transactions, and it
        is provided free and as-is.
      </p>

      <h2>6. If you are from GMI</h2>
      <p>
        If you represent the German-Malaysian Institute and have any concern
        about this project &mdash; the name, the branding, the domain, the
        content, or its existence &mdash; please write to{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
      <p>
        Requests will be acted on promptly and in good faith, including renaming
        the project or taking it offline. There is no interest in trading on
        GMI&rsquo;s name against its wishes; the intention is to build something
        useful for its students and to learn by doing it.
      </p>
    </LegalDocumentPage>
  );
}
