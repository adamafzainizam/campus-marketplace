import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listInboxFor } from "@/lib/conversations";
import { getImageUrl } from "@/lib/r2";
import { Breadcrumbs } from "@/components/Breadcrumbs";

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
        <p className="text-secondary">
          No conversations yet. Message a seller from a listing to start one.
        </p>
      ) : (
        <ul className="card flex flex-col divide-y divide-[var(--border)] overflow-hidden">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/messages/${conversation.id}`}
                className="flex items-center gap-4 py-4"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-sunken">
                  {conversation.listingImageKey && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getImageUrl(conversation.listingImageKey)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-medium">
                      {conversation.listingTitle}
                    </p>
                    {conversation.unread && (
                      <span
                        className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white"
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
