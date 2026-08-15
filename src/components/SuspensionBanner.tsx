import { LEGAL_CONTACT_EMAIL, legalPath } from "@/lib/legal";
import Link from "next/link";
import { currentActor } from "@/lib/moderation";
import { isSuspended } from "@/lib/moderation-rules";

/**
 * Tells a suspended user that they are suspended, why, and how to appeal.
 *
 * Rendered site-wide rather than only where a write is refused. A suspension
 * that announces itself as a series of unexplained failures — the post button
 * doing nothing, a message not sending — reads as the site being broken, and
 * the person's reasonable response is to try again rather than to appeal.
 *
 * Renders nothing at all for everyone else, which is the overwhelmingly common
 * case, so the layout is unchanged for ordinary users. That matters because of
 * Known Gotchas #37: anything permanently in the root layout competes with the
 * conversation thread for viewport height. A suspended user reading their
 * existing threads loses a strip to this, which is the correct trade — they
 * need to know why they can no longer reply.
 */
export async function SuspensionBanner() {
  const actor = await currentActor();
  if (!actor || !isSuspended(actor)) return null;

  const reason = actor.suspendedReason?.trim();

  return (
    <div role="status" className="border-b border-[var(--danger)] bg-[var(--danger-subtle)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-3 sm:px-6">
        <p className="text-sm font-medium text-[var(--danger)]">
          Your account is suspended. You can still read, but you can&rsquo;t
          post listings or send messages.
        </p>
        {reason && (
          <p className="mt-1 text-fine text-[var(--danger)]">Reason: {reason}</p>
        )}
        <p className="mt-1 text-fine text-[var(--danger)]">
          If you think this is a mistake, reply to{" "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="underline underline-offset-2"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          . The rules are in the{" "}
          <Link
            href={legalPath("acceptable-use")}
            className="underline underline-offset-2"
          >
            Acceptable Use Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
