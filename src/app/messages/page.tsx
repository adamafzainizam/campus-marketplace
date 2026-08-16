import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listInboxFor } from "@/lib/conversations";
import { INBOX_EMPTY } from "@/lib/site-copy";
import { getImageUrl } from "@/lib/r2";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { NoPhoto } from "@/components/NoPhoto";

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/messages");
  }

  const conversations = await listInboxFor(session.user.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Messages" }]} />
      <h1 className="mb-6 sm:mb-10">Messages</h1>

      {conversations.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center sm:py-16">
          <p className="text-display">{INBOX_EMPTY.title}</p>
          <p className="max-w-sm text-fine text-secondary">{INBOX_EMPTY.body}</p>
          {/* Browse rather than a listing: there is nothing to message about
              until you have found something. */}
          <Link href="/" className="btn btn-primary btn-sm mt-1">
            Browse listings
          </Link>
        </div>
      ) : (
        <ul className="card flex flex-col divide-y divide-[var(--border)] overflow-hidden">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/messages/${conversation.id}`}
                className="flex items-center gap-4 px-4 py-4"
              >
                {/* Same treatment as every other listing thumbnail on the
                    site. It was a 56px square that rendered a blank grey box
                    when the listing had no photograph — the one state this
                    site has most of. */}
                <div className="aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-sunken">
                  {conversation.listingImageKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getImageUrl(conversation.listingImageKey)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <NoPhoto compact />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-medium">
                      {conversation.listingTitle}
                    </p>
                    {conversation.unread && (
                      <span
                        className="badge badge-accent shrink-0"
                        aria-label="Unread messages"
                      >
                        New
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-secondary">
                    {conversation.counterpartyName}
                    {conversation.counterpartySuspended && (
                      <span className="badge badge-neutral ml-2">
                        Can&rsquo;t reply
                      </span>
                    )}
                    {conversation.lastMessage
                      ? ` · ${conversation.lastMessage}`
                      : " · No messages yet"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
