/**
 * Single source of truth for messaging rules and Ably channel naming.
 *
 * Pure functions only — no database, no Ably client — so the rules that decide
 * what a user may send and which channels a token may cover can be tested
 * directly. Anything that needs I/O lives in `src/lib/conversations.ts`.
 */

export const MESSAGE_MAX_LENGTH = 2000;

export type Valid<T> = { ok: true; value: T };
export type Invalid = { ok: false; error: string };
export type Result<T> = Valid<T> | Invalid;

const invalid = (error: string): Invalid => ({ ok: false, error });

/**
 * Message bodies arrive from a server action, which is a public POST endpoint,
 * so the type is established before any string method is called.
 *
 * Bodies are rendered as text through JSX and React escapes them. There is
 * deliberately no HTML sanitisation here, because there is deliberately no
 * HTML rendering: `dangerouslySetInnerHTML` must never be introduced on this
 * path. Stripping tags here would imply the output is trusted somewhere, which
 * is the mindset that produces XSS later.
 */
export function validateMessageBody(value: unknown): Result<string> {
  if (typeof value !== "string") return invalid("Message is required.");
  const body = value.trim();
  if (body.length === 0) {
    return invalid("Message cannot be empty.");
  }
  if (body.length > MESSAGE_MAX_LENGTH) {
    return invalid(`Message cannot exceed ${MESSAGE_MAX_LENGTH} characters.`);
  }
  return { ok: true, value: body };
}

/**
 * Ably capabilities are expressed as channel-name patterns in which `*` is a
 * wildcard. An id carrying `*`, `:` or whitespace could therefore widen the
 * capability a token is granted, so ids are checked against a strict shape
 * before they are ever interpolated into a channel name — even though the ids
 * this app uses are database-issued cuids.
 */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isSafeChannelId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID.test(value);
}

export function conversationChannel(conversationId: string): string {
  if (!isSafeChannelId(conversationId)) {
    throw new Error("Unsafe conversation id for channel name.");
  }
  return `conversation:${conversationId}`;
}

export function userChannel(userId: string): string {
  if (!isSafeChannelId(userId)) {
    throw new Error("Unsafe user id for channel name.");
  }
  return `user:${userId}`;
}

/**
 * A conversation has exactly two participants: the buyer, and the seller of
 * the listing it is attached to. The seller is derived from the listing rather
 * than duplicated onto the conversation row, so this takes both ids.
 */
export function isParticipant(
  participants: { buyerId: string; sellerId: string },
  userId: unknown,
): userId is string {
  if (typeof userId !== "string" || userId.length === 0) return false;
  return userId === participants.buyerId || userId === participants.sellerId;
}

/** The other party, from the perspective of the given viewer. */
export function counterpartyId(
  participants: { buyerId: string; sellerId: string },
  viewerId: string,
): string {
  if (!isParticipant(participants, viewerId)) {
    throw new Error("Viewer is not a participant in this conversation.");
  }
  return viewerId === participants.buyerId
    ? participants.sellerId
    : participants.buyerId;
}
