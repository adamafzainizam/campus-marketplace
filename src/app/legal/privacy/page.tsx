import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocumentPage } from "../LegalDocumentPage";
import { ALLOWED_DOMAIN_LABEL } from "@/lib/auth-domain";
import {
  findLegalDocument,
  legalPath,
  LEGAL_CONTACT_EMAIL,
} from "@/lib/legal";

const doc = findLegalDocument("privacy")!;

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
};

export default function PrivacyPage() {
  return (
    <LegalDocumentPage doc={doc}>
      <p>
        This policy explains what personal data GMI Campus Marketplace collects,
        why, who else sees it, and what you can ask to have done with it. It is
        written to meet Malaysia&rsquo;s Personal Data Protection Act 2010
        (PDPA).
      </p>
      <p>
        The short version: the service collects the minimum it needs to work,
        shows your name to people you trade with, uses no analytics and no
        advertising trackers, and will delete your account if you ask.
      </p>

      <h2>1. Who is responsible for your data</h2>
      <p>
        GMI Campus Marketplace is an independent student project, not a GMI
        service. The operator is the data user for PDPA purposes and can be
        reached at{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>

      <h2>2. What is collected</h2>

      <h3>From Google, when you sign in</h3>
      <p>
        Signing in uses your Google account. No password is ever created,
        received, or stored here. Google passes on:
      </p>
      <ul>
        <li>
          your <strong>email address</strong> &mdash; used to identify your
          account and to confirm it is on the {ALLOWED_DOMAIN_LABEL} domain;
        </li>
        <li>
          your <strong>name</strong> &mdash; shown to other users on your
          listings and in conversations;
        </li>
        <li>
          your <strong>profile picture</strong>, if your Google account has one.
        </li>
      </ul>
      <p>
        A record linking your account to Google is also stored, so that signing
        in again recognises you.
      </p>

      <h3>What you create</h3>
      <ul>
        <li>
          <strong>Listings</strong> &mdash; title, description, price,
          condition, category, and whether the item is for sale or rent.
        </li>
        <li>
          <strong>Photographs</strong> you upload. Note that photographs can
          contain more than you intend, including recognisable people, documents
          in the background, and location data.
        </li>
        <li>
          <strong>Messages</strong> you send to other users, and which
          conversations you have read.
        </li>
      </ul>

      <h3>Technical records</h3>
      <ul>
        <li>
          A <strong>sign-in session cookie</strong>, so you stay signed in
          between pages.
        </li>
        <li>
          <strong>Rate-limit counters</strong> &mdash; a count of recent actions
          per account, used to stop abuse and keep the service within its free
          hosting limits.
        </li>
        <li>
          Ordinary <strong>server logs</strong> kept by the hosting providers
          listed below, which may include IP addresses. These are held by those
          providers under their own policies.
        </li>
      </ul>
      <p>
        There is <strong>no analytics</strong>, no advertising network, and no
        third-party tracking of any kind on this site.
      </p>

      <h3>Reports and moderation records</h3>
      <p>
        If you <strong>report</strong> something, a record is kept of what you
        reported, the reason you chose, anything you wrote, and that it was you.
        The person reported is not told who reported them.
      </p>
      <p>
        If action is taken on your account or a listing &mdash; a suspension, or
        a listing removed for breaking the{" "}
        <Link href={legalPath("acceptable-use")}>Acceptable Use Policy</Link>{" "}
        &mdash; a record is kept of what was done, when, by which
        administrator, and why. So is a decision to do nothing.
      </p>
      <p>
        These records are kept even after the thing they refer to is gone, and
        they are <strong>not deleted when an action is reversed</strong>. That
        is deliberate: a log that can be edited by the people it records is not
        a log, and the ability to show that a suspension was lifted protects
        you as much as it does anyone. If your account is suspended you will be
        told the reason.
      </p>

      <h2>3. Why it is collected</h2>
      <ul>
        <li>To let you sign in and to keep your account yours.</li>
        <li>
          To restrict the marketplace to the GMI community, which is the only
          thing standing in for trust between strangers here.
        </li>
        <li>To show your listings and deliver your messages.</li>
        <li>To prevent abuse and stay inside free-tier service limits.</li>
      </ul>
      <p>
        Your data is not sold, rented, or shared for marketing. There is nobody
        to sell it to and no intention to.
      </p>

      <h2>4. Who else sees it</h2>

      <h3>Other users</h3>
      <p>
        Your <strong>name</strong> and <strong>profile picture</strong> appear
        on your listings and in conversations you take part in, along with
        anything you write. Assume anything you post can be screenshotted.
      </p>
      <p>
        Your <strong>email address is never shown to other people using the
        site</strong> &mdash; not on your listings, and not in conversations.
      </p>

      <h3>Administrators</h3>
      <p>
        One exception, stated plainly rather than left for you to discover: an
        administrator can see the name and email address of every account, on
        the moderation screen. There is currently one administrator &mdash; the
        student who runs the service.
      </p>
      <p>
        That access exists so an account can be identified when a rule is
        broken, since two people may share a display name.
      </p>

      <h3>When a message is reported</h3>
      <p>
        If somebody reports one of your messages, an administrator can read{" "}
        <strong>that message and the three either side of it</strong>, so that
        it can be judged in context &mdash; a single line is often innocent or
        serious depending on what came before it.
      </p>
      <p>They cannot read the rest of the conversation. Specifically:</p>
      <ul>
        <li>
          no screen anywhere shows a whole thread to somebody who isn&rsquo;t
          part of it;
        </li>
        <li>
          the messages outside that window are never fetched from the database
          at all, rather than fetched and hidden;
        </li>
        <li>
          reading a reported message is <strong>itself recorded</strong> in the
          moderation log, against the administrator&rsquo;s name, before the
          content is shown to them. Looking is an action on the record, not a
          standing privilege.
        </li>
      </ul>
      <p>
        Nothing is read unless somebody reports it. There is no routine
        monitoring of messages.
      </p>
      <p>
        Being straight about the limit of that: the person who runs the service
        also holds the database credentials, as the operator of any small
        service does, and a database can be queried directly. What is being
        promised here is that the application provides no such feature and that
        it is not done &mdash; not that it is technically impossible. If that
        distinction matters to you, treat these messages the way you would
        treat any message on a service you do not host yourself.
      </p>

      <h3>Service providers</h3>
      <p>
        The service runs on infrastructure operated by other companies, which
        necessarily process data on its behalf:
      </p>
      <ul>
        <li>
          <strong>Google</strong> &mdash; sign-in.
        </li>
        <li>
          <strong>Vercel</strong> &mdash; hosting and delivery of the site.
        </li>
        <li>
          <strong>Neon</strong> &mdash; the database, hosted in{" "}
          <strong>Singapore</strong>. Accounts, listings, and messages live
          here.
        </li>
        <li>
          <strong>Cloudflare R2</strong> &mdash; storage of uploaded
          photographs.
        </li>
        <li>
          <strong>Ably</strong> &mdash; delivery of messages in real time, so a
          message appears without refreshing the page. Ably holds message
          contents only briefly in transit; the lasting copy is in the database.
        </li>
      </ul>
      <p>
        Data may also be disclosed where the law requires it, or where it is
        necessary to investigate a serious safety concern or breach of the{" "}
        <Link href={legalPath("acceptable-use")}>Acceptable Use Policy</Link>.
      </p>

      <h2>5. Where your data goes</h2>
      <p>
        The providers above operate outside Malaysia, so your personal data is
        transferred and stored abroad &mdash; the database is in Singapore, and
        the other providers operate globally. By using the service you consent
        to that transfer. It is unavoidable for a service built on free hosting;
        there is no Malaysia-only option at this scale.
      </p>

      <h2>6. Cookies</h2>
      <p>
        One cookie is set: the sign-in session cookie, which is{" "}
        <strong>strictly necessary</strong> for the service to know who you are.
        Without it, signing in cannot work.
      </p>
      <p>
        There are no analytics, advertising, or tracking cookies, which is why
        this site shows no cookie consent banner &mdash; there is nothing to
        consent to beyond what the service cannot function without.
      </p>

      <h2>7. How long it is kept</h2>
      <ul>
        <li>
          <strong>Account details</strong> &mdash; while your account exists.
        </li>
        <li>
          <strong>Listings and messages</strong> &mdash; while your account
          exists, or until deleted. Messages are kept for both people in a
          conversation, so a conversation does not vanish for one person because
          the other removed a listing.
        </li>
        <li>
          <strong>Photographs</strong> &mdash; while the listing referencing
          them exists. Uploads never attached to a listing are deleted
          automatically by a daily cleanup job.
        </li>
        <li>
          <strong>Rate-limit counters</strong> &mdash; a short window, then
          overwritten.
        </li>
        <li>
          <strong>Moderation records</strong> &mdash; kept indefinitely, and
          not removed when an account is deleted or a suspension lifted, for
          the reason given above.
        </li>
      </ul>

      <h2>8. Your rights</h2>
      <p>Under the PDPA you may ask to:</p>
      <ul>
        <li>
          <strong>Access</strong> the personal data held about you.
        </li>
        <li>
          <strong>Correct</strong> anything inaccurate. You can edit your own
          listings directly; your name and picture come from Google, so change
          them there.
        </li>
        <li>
          <strong>Withdraw consent</strong> and have your account and data
          deleted.
        </li>
        <li>
          <strong>Limit</strong> how your data is processed.
        </li>
      </ul>
      <p>
        Email{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> from
        the address on your account. Requests are handled as quickly as one
        person reasonably can &mdash; expect days, not minutes.
      </p>
      <p>
        Two honest limits. Deleting your account removes your listings and your
        side of conversations, but messages you sent may remain visible to the
        person you sent them to, because they form part of their record of a
        conversation too. And moderation records are kept, for the reason set
        out above &mdash; they are the record of an action taken, not a record
        of you.
      </p>

      <h2>9. Security</h2>
      <p>
        Sign-in is handled by Google, so no password exists here to be stolen.
        Traffic is encrypted in transit. Real-time connections are issued
        credentials that can only listen to conversations you belong to, and
        never permission to write. Access to conversations is checked on the
        server for every request.
      </p>
      <p>
        No system is perfectly secure, and this one is a student project rather
        than a bank. Please don&rsquo;t send anything through it you would be
        harmed by disclosing &mdash; no identity card numbers, no banking
        details, no passwords. If you find a security problem, please report it
        to the address above rather than testing it against other users.
      </p>

      <h2>10. Children</h2>
      <p>
        The service is aimed at students and staff of GMI. If you are under 18,
        please use it with a parent or guardian&rsquo;s knowledge. If you
        believe a child&rsquo;s data has been collected inappropriately, contact
        the address above and it will be removed.
      </p>

      <h2>11. Changes</h2>
      <p>
        This policy may change. The date at the top shows when it last did. A
        material change will be reflected here before it takes effect.
      </p>
    </LegalDocumentPage>
  );
}
