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
      const result = await startConversation(listingId);
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      router.push(`/messages/${result.value}`);
    } catch (err) {
      // Only genuinely unexpected failures reach here now; expected ones come
      // back as `result.error` above, which survives production error masking.
      setError(err instanceof Error ? err.message : "Could not open the chat.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="btn btn-primary w-full sm:w-auto"
      >
        {busy ? "Opening chat..." : "Message seller"}
      </button>
      {error && (
        <p className="notice notice-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
