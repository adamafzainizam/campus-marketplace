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
    <div className="thread-viewport mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
      <div className="mb-4 border-b border-line pb-4">
        <Breadcrumbs
          items={[
            { label: "Messages", href: "/messages" },
            { label: thread.listingTitle },
          ]}
        />
        {/*
          Deliberately off the h1 type scale. That scale tops out at 2.25rem,
          which is right for a page title and wrong here: this is a compact bar
          above a conversation that sizes itself to the remaining viewport, and
          every pixel it takes comes out of the messages. The display face
          still applies — it comes from the shared h1/h2/h3 font rule, which
          this only overrides for size and weight.
        */}
        <h1 className="text-lg font-semibold">
          <Link href={`/listings/${thread.listingId}`} className="hover:underline">
            {thread.listingTitle}
          </Link>
        </h1>
        <p className="text-sm text-secondary">
          with {thread.counterpartyName}
        </p>

        {/* Otherwise you sit waiting for a reply that cannot come: a suspended
            account can still read, but not send. Placed in the header rather
            than among the messages so it is seen before anything is typed. */}
        {thread.counterpartySuspended && (
          <p role="status" className="notice notice-danger mt-3">
            {thread.counterpartyName}&rsquo;s account is suspended, so they
            can&rsquo;t reply at the moment. They can still read what you send.
          </p>
        )}
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
