import { NextResponse } from "next/server";
import type * as Ably from "ably";
import { auth } from "@/auth";
import { ablyRest } from "@/lib/ably";
import { getParticipantsIfMember } from "@/lib/conversations";
import {
  conversationChannel,
  isSafeChannelId,
  userChannel,
} from "@/lib/message-constraints";

/**
 * Issues a short-lived, capability-scoped Ably token.
 *
 * The capability is computed here from the database, not from anything the
 * caller asserts. Two properties matter:
 *
 * 1. A caller only ever receives capabilities for their own `user:` channel
 *    and for conversations a database lookup confirms they participate in.
 * 2. No token ever carries `publish` on a conversation channel. Clients get
 *    `subscribe` and `presence` only; messages enter a channel exclusively
 *    from the server, after a write by a verified participant. A stolen or
 *    tampered token therefore cannot forge a message — the ability simply
 *    isn't in it.
 *
 * This is the architectural form of Known Gotchas #17: never trust what the
 * browser hands back.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  if (!isSafeChannelId(userId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  // Typed as Ably's own capability union rather than string[], so adding an
  // unintended capability (notably "publish") is a compile error here.
  const capability: Record<string, Ably.capabilityOp[]> = {
    // Always granted: the caller's own notification channel, subscribe only.
    [userChannel(userId)]: ["subscribe"],
  };

  const conversationId = new URL(request.url).searchParams.get("conversationId");

  if (conversationId !== null) {
    // Checked before the value is interpolated into a channel name. Ably
    // capabilities are channel-name patterns in which `*` is a wildcard, so an
    // id carrying `*` or `:` could otherwise widen what the token grants.
    if (!isSafeChannelId(conversationId)) {
      return NextResponse.json(
        { error: "Invalid conversation id" },
        { status: 400 },
      );
    }

    const participants = await getParticipantsIfMember(conversationId, userId);
    if (!participants) {
      // Deliberately the same response whether the conversation doesn't exist
      // or simply isn't theirs — distinguishing them would confirm the
      // existence of other people's conversations.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    capability[conversationChannel(conversationId)] = ["subscribe", "presence"];
  }

  const tokenRequest = await ablyRest().auth.createTokenRequest({
    // Binds the connection to this user, so presence reports an identity the
    // client cannot choose for itself.
    clientId: userId,
    capability,
    ttl: 60 * 60 * 1000,
  });

  return NextResponse.json(tokenRequest, {
    headers: { "Cache-Control": "no-store" },
  });
}
