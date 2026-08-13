"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startConversation } from "@/app/messages/actions";

/**
 * Opens (or reopens) the thread with this listing's seller.
 *
 * `startConversation` is idempotent thanks to the unique constraint on
 * (listingId, buyerId), so a double-click can't produce two threads.
 */
export function ContactSellerButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const conversationId = await startConversation(listingId);
      router.push(`/messages/${conversationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the chat.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
      >
        {busy ? "Opening chat..." : "Message seller"}
      </button>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
