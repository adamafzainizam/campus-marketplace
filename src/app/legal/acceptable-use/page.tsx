import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocumentPage } from "../LegalDocumentPage";
import { findLegalDocument, legalPath, LEGAL_CONTACT_EMAIL } from "@/lib/legal";

const doc = findLegalDocument("acceptable-use")!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
};

export default function AcceptableUsePage() {
  return (
    <LegalDocumentPage doc={doc}>
      <p>
        This policy sets out what may not be listed or done on GMI Campus
        Marketplace. It forms part of the{" "}
        <Link href={legalPath("terms")}>Terms of Service</Link>.
      </p>
      <p>
        The service exists so people on campus can pass on things they no longer
        need. Everything below follows from that, plus one rule that matters
        more here than on a general marketplace: nothing on this service may be
        used to help anyone cheat.
      </p>

      <h2>1. Academic integrity</h2>
      <p>
        This section comes first because it is the one specific to a campus. You
        may not use the service to offer, request, buy, or sell:
      </p>
      <ul>
        <li>
          examination papers, question banks, or any assessment material that
          has not been publicly released;
        </li>
        <li>
          completed assignments, lab reports, projects, or theses intended to be
          submitted as someone else&rsquo;s work;
        </li>
        <li>
          essay-writing, assignment-writing, coding-for-hire, or
          sit-my-exam services;
        </li>
        <li>
          accounts, credentials, or access to institutional systems, licensed
          software, or subscription services.
        </li>
      </ul>
      <p>
        Second-hand textbooks, your own old notes, and legitimate tutoring are
        all fine, and are much of what the service is for. The line is whether
        the work someone submits is honestly their own.
      </p>

      <h2>2. Items that may not be listed</h2>
      <ul>
        <li>
          Anything unlawful in Malaysia, or that you may not lawfully sell
          without a licence you do not hold.
        </li>
        <li>
          Drugs and controlled substances, including prescription medicines,
          supplements sold as medicines, and drug paraphernalia.
        </li>
        <li>Alcohol, tobacco, vapes, and e-cigarette products.</li>
        <li>
          Weapons, ammunition, replica or imitation firearms, and knives sold as
          weapons.
        </li>
        <li>Stolen goods, or anything you cannot show you are entitled to sell.</li>
        <li>
          Counterfeit goods, unauthorised copies of books, software, or media,
          and pirated content.
        </li>
        <li>Pornography or sexually explicit material.</li>
        <li>Live animals.</li>
        <li>
          Hazardous materials, including damaged or swollen lithium batteries.
        </li>
        <li>
          Money, financial products, loans, cryptocurrency, gambling, and
          anything structured as an investment.
        </li>
        <li>
          Personal data, contact lists, or information about other people.
        </li>
        <li>
          Recruitment into multi-level marketing, referral schemes, or
          &ldquo;business opportunities&rdquo;.
        </li>
      </ul>

      <h2>3. How you must behave</h2>
      <p>You may not:</p>
      <ul>
        <li>
          harass, threaten, bully, or discriminate against anyone, or post
          content that does;
        </li>
        <li>
          impersonate another person, or present yourself as a member of GMI
          staff, GMI itself, or the operator of this service;
        </li>
        <li>
          deceive anyone &mdash; misdescribing an item, faking a fault-free
          condition, advertising a price you do not intend to honour, or taking
          payment for something you will not hand over;
        </li>
        <li>post the same listing repeatedly, or spam other users;</li>
        <li>
          use the service to advertise a business, unless it is genuinely your
          own second-hand goods;
        </li>
        <li>
          upload photographs of other people without their permission, or
          anything showing someone&rsquo;s documents, address, or identity
          details;
        </li>
        <li>
          share another user&rsquo;s messages, contact details, or personal
          information outside the service;
        </li>
        <li>
          scrape, bulk-download, or automate access to the service, or try to
          get around the sign-in restriction, rate limits, or any other control;
        </li>
        <li>
          probe, scan, or test the security of the service against other
          users&rsquo; data. If you want to report a vulnerability, please do
          &mdash; see below.
        </li>
      </ul>

      <h2>4. Meeting and paying safely</h2>
      <p>
        No payment passes through the service, so nobody can reverse a
        transaction for you. Meet in a public place on campus, in daylight,
        preferably with someone else present. Inspect an item before you pay for
        it. Be wary of anyone who insists on paying in advance, offers more than
        the asking price, or wants to move the conversation somewhere else
        immediately.
      </p>

      <h2>5. What happens if this policy is broken</h2>
      <p>Depending on how serious it is, any of the following may happen:</p>
      <ul>
        <li>you are asked to change something;</li>
        <li>
          <strong>the listing is taken down</strong> &mdash; archived rather
          than deleted, so any conversation about it survives for both people;
        </li>
        <li>
          <strong>your account is suspended</strong> &mdash; you keep read
          access to the site and to conversations you are already part of, but
          you cannot post, message, or upload a photograph until it is lifted.
          You are shown the reason;
        </li>
        <li>
          in the most serious cases, the account is removed entirely;
        </li>
        <li>
          the matter is reported to GMI or to the police, where there is a
          genuine safety concern or the law requires it.
        </li>
      </ul>
      <p>
        Every action is recorded with its reason in an internal log, including
        actions that are later reversed. If your account is suspended you can
        appeal by emailing{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> from
        the address on your account.
      </p>
      <p>
        <strong>Nothing here is monitored automatically.</strong> There is no
        content filtering, no automated scanning, and nobody watching the site.
        Action follows a report from someone who saw the problem &mdash; which
        is why the section below matters more than it looks. Serious cases are
        acted on as soon as they are seen; otherwise you will normally be told
        what the problem is first.
      </p>

      <h2>6. Reporting something</h2>
      <p>
        Every listing has a <strong>Report</strong> button, and so does every
        message somebody else sent you. Choose the reason that fits and add
        anything else worth knowing. The report goes to a moderator; you
        won&rsquo;t normally hear back, and no action is guaranteed &mdash; a
        report is a request to look, not a verdict.
      </p>
      <p>
        You can&rsquo;t report your own listing or your own message, and the
        same thing can only be reported by you once.
      </p>
      <p>
        For anything the button doesn&rsquo;t cover &mdash; a security problem,
        something about an account rather than a specific listing or message, or
        anything urgent &mdash; email{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> with
        a link or a screenshot and a short description.
      </p>
      <p>
        If you are in immediate danger, contact the police (999) or GMI security
        first. This is a student project, not an emergency service, and nobody
        is monitoring it around the clock.
      </p>
    </LegalDocumentPage>
  );
}
