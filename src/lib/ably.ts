import "server-only";

import Ably from "ably";

/**
 * Server-side Ably client.
 *
 * `server-only` at the top of this file makes importing it from a Client
 * Component a build error rather than a runtime surprise — the API key is a
 * full-privilege credential and must never reach the browser. Note the env var
 * is deliberately NOT prefixed `NEXT_PUBLIC_`, which would inline it into the
 * client bundle.
 *
 * Clients authenticate through `/api/ably/token`, which issues short-lived
 * tokens scoped to the specific channels that caller is entitled to.
 */
function apiKey(): string {
  const key = process.env.ABLY_API_KEY;
  if (!key) {
    throw new Error("ABLY_API_KEY is not set.");
  }
  return key;
}

let client: Ably.Rest | undefined;

export function ablyRest(): Ably.Rest {
  if (!client) {
    client = new Ably.Rest(apiKey());
  }
  return client;
}

/**
 * Publishes to a channel from the server.
 *
 * Every message reaching a channel goes through here, after a database write
 * by a verified participant. Clients are never granted `publish` capability,
 * so this is the only path by which a message can appear in a conversation.
 */
export async function publish(
  channelName: string,
  eventName: string,
  data: unknown,
): Promise<void> {
  await ablyRest().channels.get(channelName).publish(eventName, data);
}
