/**
 * What a shared link shows in WhatsApp, Telegram, LinkedIn and the like.
 *
 * A listing's preview is only built when browse would show the listing too:
 * not archived, and its seller not suspended. The page itself still renders
 * for a direct visitor, but a preview travels further than a visit. It is
 * fetched by a chat app's crawler and kept in chat history, so a listing
 * taken off browse should not keep advertising itself there. Anything else
 * falls back to the site-wide card.
 *
 * Relative imports with explicit extensions, because a test reaches this
 * module (Known Gotchas #21 and #23).
 */

import type { ListingStatus } from "../generated/prisma/enums.ts";
import { isPubliclyVisible } from "./listing-status.ts";

/** Crawlers cut descriptions at roughly this length, so cut first, on a word. */
export const PREVIEW_DESCRIPTION_MAX = 160;

export type ListingPreviewInput = {
  title: string;
  description: string;
  status: ListingStatus;
  sellerSuspended: boolean;
  amount: string;
  unit: string | null;
  imageUrl: string | null;
};

export type ListingPreview = {
  title: string;
  description: string;
  imageUrl: string | null;
};

export function truncateForPreview(
  text: string,
  max: number = PREVIEW_DESCRIPTION_MAX,
): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,.;:!?-]+$/, "")}…`;
}

export function listingPreview(input: ListingPreviewInput): ListingPreview | null {
  if (!isPubliclyVisible(input.status) || input.sellerSuspended) return null;

  const price = input.unit ? `${input.amount} ${input.unit}` : input.amount;
  return {
    title: input.title,
    description: truncateForPreview(`${price}. ${input.description}`),
    imageUrl: input.imageUrl,
  };
}
