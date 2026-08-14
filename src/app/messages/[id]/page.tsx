import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getThreadFor } from "@/lib/conversations";
import { MessageThread } from "./MessageThread";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/messages/${id}`);
  }

  // Returns null both when the conversation doesn't exist and when it isn't
  // this user's, so a 404 is the correct and non-revealing response to either.
  const thread = await getThreadFor(id, session.user.id);
  if (!thread) {
    notFound();
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col px-6 py-6">
      <div className="mb-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <Breadcrumbs
          items={[
            { label: "Messages", href: "/messages" },
            { label: thread.listingTitle },
          ]}
        />
        <h1 className="text-lg font-semibold">
          <Link href={`/listings/${thread.listingId}`} className="hover:underline">
            {thread.listingTitle}
          </Link>
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          with {thread.counterpartyName}
        </p>
      </div>

      <MessageThread
        conversationId={thread.id}
        viewerId={session.user.id}
        counterpartyId={thread.counterpartyId}
        counterpartyName={thread.counterpartyName}
        initialMessages={thread.messages.map((message) => ({
          id: message.id,
          body: message.body,
          senderId: message.senderId,
          createdAt: message.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
