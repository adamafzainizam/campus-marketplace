import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocumentPage } from "../LegalDocumentPage";
import { ALLOWED_DOMAIN_LABEL } from "@/lib/auth-domain";
import {
  findLegalDocument,
  legalPath,
  LEGAL_CONTACT_EMAIL,
} from "@/lib/legal";

const doc = findLegalDocument("terms")!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
};

export default function TermsPage() {
  return (
    <LegalDocumentPage doc={doc}>
      <p>
        These terms are the agreement between you and GMI Campus Marketplace
        (&ldquo;the service&rdquo;). By signing in or using the service, you
        accept them. If you don&rsquo;t accept them, please don&rsquo;t use the
        service.
      </p>

      <h2>1. Who runs this</h2>
      <p>
        The service is an <strong>independent student project</strong>, built
        and run by one person as portfolio work. It is not affiliated with,
        endorsed by, or operated by the German-Malaysian Institute
        (&ldquo;GMI&rdquo;), and nothing here is an official GMI service or
        communication. See the{" "}
        <Link href={legalPath("disclaimer")}>Disclaimer</Link> for more.
      </p>
      <p>
        You can reach the operator at{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>

      <h2>2. Who may use it</h2>
      <p>
        Signing in requires a Google account on the{" "}
        <strong>{ALLOWED_DOMAIN_LABEL}</strong> domain or one of its
        subdomains. Anyone may browse listings without an account.
      </p>
      <p>
        If you are under 18, please use the service with the knowledge and
        permission of a parent or guardian, and take an adult with you to any
        meeting arranged through it.
      </p>
      <p>
        You are responsible for what happens under your account. Don&rsquo;t
        share your Google sign-in, and tell us if you think someone else has
        used your account.
      </p>

      <h2>3. What this service is &mdash; and is not</h2>
      <p>
        The service is a <strong>noticeboard</strong>. It lets members of the
        GMI community advertise items to each other and talk about them. That
        is all it does.
      </p>
      <p>In particular, the service:</p>
      <ul>
        <li>
          is <strong>not a party</strong> to any sale, rental, or other
          agreement you make with another user;
        </li>
        <li>
          <strong>does not handle payment</strong> of any kind &mdash; there is
          no checkout, no escrow, and no refund mechanism, because no money ever
          passes through it;
        </li>
        <li>
          <strong>does not inspect, verify, or value</strong> any item, and does
          not check that a seller owns what they are listing or that a
          description is truthful;
        </li>
        <li>
          <strong>does not vet users</strong> beyond checking that an email
          address is on the institutional domain.
        </li>
      </ul>
      <p>
        Any agreement you reach is between you and the other user, and enforcing
        it is between you and them. Please meet in a public place on campus,
        inspect an item before paying for it, and use your judgement.
      </p>

      <h2>4. Your listings and messages</h2>
      <p>By posting anything, you confirm that:</p>
      <ul>
        <li>you own the item, or are otherwise entitled to sell or rent it;</li>
        <li>
          the description, price, and photographs are accurate and not
          misleading;
        </li>
        <li>
          the item and your conduct comply with the{" "}
          <Link href={legalPath("acceptable-use")}>Acceptable Use Policy</Link>;
        </li>
        <li>
          you own the photographs you upload, or have permission to use them.
        </li>
      </ul>
      <p>
        You keep ownership of everything you post. You give the service
        permission to store and display it for the purpose of running the
        marketplace &mdash; nothing more. That permission ends when the content
        is deleted, except for copies in ordinary backups.
      </p>

      <h2>5. Suspension and removal</h2>
      <p>
        Listings that break these terms or the{" "}
        <Link href={legalPath("acceptable-use")}>Acceptable Use Policy</Link>{" "}
        may be taken down, and accounts may be suspended.
      </p>
      <p>
        <strong>What suspension actually does:</strong> you can still sign in
        and read the site, including conversations you are already part of, but
        you cannot post a listing, send a message, or upload a photograph. You
        are shown the reason. It is not permanent by default and can be lifted.
      </p>
      <p>
        Listings taken down are <strong>archived rather than deleted</strong>,
        so that a conversation you and another person have already had is not
        destroyed along with the listing it was about.
      </p>
      <p>
        <strong>Nothing here is monitored automatically.</strong> There is no
        filtering and nobody watching; action follows a report. Where a problem
        is serious it may be acted on without warning, and in the most serious
        cases an account may be removed entirely. Otherwise you will normally be
        told what the problem is and given a chance to respond. Every action
        taken is recorded, with its reason, in an internal log.
      </p>
      <p>
        To appeal, email{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> from
        the address on your account.
      </p>
      <p>
        You may stop using the service at any time and ask for your account to
        be deleted &mdash; see the{" "}
        <Link href={legalPath("privacy")}>Privacy Policy</Link>.
      </p>

      <h2>6. Availability</h2>
      <p>
        The service is free, runs on free hosting tiers, and is maintained by
        one student around their studies. It may be slow, unavailable, or
        changed at any time, and it may be discontinued entirely. No uptime is
        promised, and none should be relied on. Please don&rsquo;t treat it as
        the only record of anything that matters to you.
      </p>

      <h2>7. No warranty</h2>
      <p>
        The service is provided <strong>&ldquo;as is&rdquo;</strong>, without
        warranties of any kind, so far as the law allows. There is no promise
        that it will be available, error-free, or secure, or that any listing,
        user, item, or message on it is genuine, accurate, or lawful.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        So far as the law allows, the operator is not liable for any loss or
        damage arising from your use of the service &mdash; including anything
        that goes wrong in a transaction with another user, anything you buy or
        rent through it, the conduct of any user, or the service being
        unavailable or losing data.
      </p>
      <p>
        This does not limit liability for anything that cannot lawfully be
        limited, such as fraud or death or personal injury caused by negligence.
        Nothing in these terms affects rights you have under Malaysian consumer
        protection law that cannot be excluded by agreement.
      </p>
      <p>
        Because the service is provided free of charge, no compensation is
        offered for its use. If you consider that unreasonable, the right course
        is not to use it.
      </p>

      <h2>9. Changes to these terms</h2>
      <p>
        These terms may change as the service does. The date at the top shows
        when they last changed. Continuing to use the service after a change
        means you accept the new version; if you don&rsquo;t, please stop using
        it and ask for your account to be deleted.
      </p>

      <h2>10. Governing law</h2>
      <p>
        These terms are governed by the laws of Malaysia, and the courts of
        Malaysia have jurisdiction over any dispute about them.
      </p>
      <p>
        If any part of these terms turns out to be unenforceable, the rest of
        them still apply.
      </p>
    </LegalDocumentPage>
  );
}
