"use client";

import { useState, useTransition } from "react";
import { setListingStatus } from "@/app/listings/new/actions";
import { SELLER_SELECTABLE_STATUSES, statusLabel } from "@/lib/listing-status";
import type { ListingStatus, ListingType } from "@/generated/prisma/enums";

/**
 * Changes a listing's status from the seller's own list.
 *
 * The select is optimistic so the control doesn't feel dead while the request
 * is in flight, and reverts on failure — the server is still the authority,
 * and it re-checks ownership on every call.
 */
export function ListingStatusControl({
  listingId,
  status,
  type,
}: {
  listingId: string;
  status: ListingStatus;
  type: ListingType;
}) {
  const [current, setCurrent] = useState<ListingStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleChange(next: ListingStatus) {
    const previous = current;
    setCurrent(next);
    setError(null);

    startTransition(async () => {
      const result = await setListingStatus(listingId, next);
      if (!result.ok) {
        setCurrent(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm">
        <span className="sr-only">Status</span>
        <select
          value={current}
          disabled={pending}
          onChange={(e) => handleChange(e.target.value as ListingStatus)}
          className="field h-9 min-h-0 w-auto py-1 text-sm disabled:opacity-50"
        >
          {SELLER_SELECTABLE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {statusLabel(value, type)}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="text-fine text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
