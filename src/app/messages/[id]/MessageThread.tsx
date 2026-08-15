"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Ably from "ably";
import { markRead, sendMessage } from "../actions";
import { MESSAGE_MAX_LENGTH } from "@/lib/message-constraints";
import { ReportButton } from "@/components/ReportButton";

type ThreadMessage = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  /** Shown immediately on send, before the server round-trip confirms it. */
  pending?: boolean;
};

type Props = {
  conversationId: string;
  viewerId: string;
  counterpartyId: string;
  counterpartyName: string;
  initialMessages: ThreadMessage[];
};

/**
 * The realtime half of a conversation.
 *
 * The Ably client is constructed with `authUrl` rather than an API key, so the
 * browser never holds a credential — it fetches a short-lived token scoped to
 * this one conversation. Note there is no `publish` call anywhere in this
 * file: the token doesn't grant that capability, and messages reach the
 * channel only from the server after a database write. Sending goes through a
 * server action, never through Ably directly.
 */
export function MessageThread({
  conversationId,
  viewerId,
  counterpartyId,
  counterpartyName,
  initialMessages,
}: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counterpartyPresent, setCounterpartyPresent] = useState(false);
  const [connected, setConnected] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  /** Appends a server-confirmed message, replacing its optimistic twin. */
  const acceptMessage = useCallback((incoming: ThreadMessage) => {
    setMessages((current) => {
      if (current.some((message) => message.id === incoming.id)) {
        return current;
      }
      const pendingTwin = current.findIndex(
        (message) =>
          message.pending &&
          message.senderId === incoming.senderId &&
          message.body === incoming.body,
      );
      if (pendingTwin === -1) {
        return [...current, incoming];
      }
      const next = [...current];
      next[pendingTwin] = incoming;
      return next;
    });
  }, []);

  useEffect(() => {
    const client = new Ably.Realtime({
      authUrl: `/api/ably/token?conversationId=${encodeURIComponent(conversationId)}`,
      // Without this the SDK connects during render on the server. See
      // ably-js issue #1742.
      autoConnect: typeof window !== "undefined",
    });

    const channel = client.channels.get(`conversation:${conversationId}`);

    client.connection.on("connected", () => setConnected(true));
    client.connection.on("disconnected", () => setConnected(false));
    client.connection.on("failed", () => {
      setConnected(false);
      setError("Lost connection to the message service. Refresh to reconnect.");
    });

    channel.subscribe("message", (event) => {
      const data = event.data as ThreadMessage;
      acceptMessage({
        id: data.id,
        body: data.body,
        senderId: data.senderId,
        createdAt: data.createdAt,
      });
    });

    const syncPresence = async () => {
      try {
        const members = await channel.presence.get();
        setCounterpartyPresent(
          members.some((member) => member.clientId === counterpartyId),
        );
      } catch {
        // Presence is a nicety; failing to read it must not break the thread.
      }
    };

    channel.presence.subscribe(["enter", "leave", "present"], syncPresence);
    void channel.presence.enter();
    void syncPresence();

    return () => {
      channel.presence.leave().catch(() => {});
      channel.unsubscribe();
      client.close();
    };
  }, [conversationId, counterpartyId, acceptMessage]);

  // Clear the unread badge once the thread is actually on screen.
  useEffect(() => {
    void markRead(conversationId).catch(() => {});
  }, [conversationId, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (body.length === 0 || sending) return;

    setError(null);
    setSending(true);

    const optimistic: ThreadMessage = {
      id: `pending-${Date.now()}`,
      body,
      senderId: viewerId,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((current) => [...current, optimistic]);
    setDraft("");

    try {
      const result = await sendMessage(conversationId, body);
      if (!result.ok) {
        // Same rollback as the catch below: the optimistic message never
        // reached the server, so it must not stay on screen, and the draft is
        // handed back so nothing the user typed is lost.
        setMessages((current) =>
          current.filter((message) => message.id !== optimistic.id),
        );
        setDraft(body);
        setError(result.error);
        return;
      }
    } catch (err) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimistic.id),
      );
      setDraft(body);
      setError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <p className="mb-2 text-fine text-tertiary" aria-live="polite">
        {counterpartyPresent
          ? `${counterpartyName} is in this chat`
          : connected
            ? `${counterpartyName} is not currently viewing this chat`
            : "Connecting..."}
      </p>

      <div className="flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-2 py-2">
          {messages.map((message) => {
            const mine = message.senderId === viewerId;
            return (
              <li
                key={message.id}
                className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
 mine
 ? "bg-accent text-[var(--accent-contrast)]"
 : "bg-surface-sunken border border-line"
 } ${message.pending ? "opacity-60" : ""}`}
                >
                  {/* Rendered as text through JSX, so React escapes it. Never
                      introduce dangerouslySetInnerHTML on this path. */}
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                </div>
                {/* Only on the other person's messages, and not on one still
                    sending — there is nothing to report until it exists. Kept
                    out of the bubble so it never competes with the message. */}
                {!mine && !message.pending && (
                  <ReportButton
                    targetType="MESSAGE"
                    targetId={message.id}
                    label="Report"
                  />
                )}
              </li>
            );
          })}
        </ul>
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-line pt-4">
        <label htmlFor="message-body" className="sr-only">
          Message
        </label>
        <input
          id="message-body"
          type="text"
          value={draft}
          maxLength={MESSAGE_MAX_LENGTH}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message..."
          className="field flex-1"
        />
        <button
          type="submit"
          disabled={sending || draft.trim().length === 0}
          className="btn btn-primary"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </>
  );
}
